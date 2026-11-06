import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { toast } from 'sonner';

const money = (minor, currency) => `${currency} ${(Number(minor) / 100).toFixed(2)}`;
const minorUnits = (value) => {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Use a positive amount with up to two decimal places');
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};

export default function Payments() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const admin = user.role === 'admin';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState('mobile_money');
  const [amount, setAmount] = useState('20.00');
  const [currency, setCurrency] = useState('USD');
  const [schoolName, setSchoolName] = useState('');
  const [payerDetails, setPayerDetails] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [notes, setNotes] = useState({});
  const [verify, setVerify] = useState('');
  const [verified, setVerified] = useState(null);
  const load = useCallback(async () => {
    try {
      const [data, settings, contacts] = await Promise.all([
        api.get('/billing'), api.get('/billing/plan'), admin ? api.get('/users/students/list') : Promise.resolve(null),
      ]);
      setPayments(data.data.payments);
      setInvoices(data.data.invoices);
      setPlan(settings.data);
      setStudents(contacts?.data.students || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load billing. Try again.');
    } finally { setLoading(false); }
  }, [admin]);
  useEffect(() => { load(); const timer = setInterval(() => { if (!document.hidden) load(); }, 30000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { if (!socket) return; socket.on('billing_changed', load); return () => socket.off('billing_changed', load); }, [socket, load]);

  const submit = async (event, invoice = false) => {
    event.preventDefault();
    setBusy(true);
    try {
      const allocations = admin && !invoiceId ? selected.map((studentId) => ({ studentId, amountMinor: minorUnits(amount) })) : undefined;
      await api.post(invoice ? '/billing/invoices' : '/billing', { allocations, currency, schoolName, payerDetails, contactEmail, invoiceId: invoiceId ? Number(invoiceId) : undefined, method, providerReference: reference });
      toast.success(invoice ? 'Invoice generated. Download and send it to the school.' : 'Payment submitted for manual review.');
      setReference('');
      await load();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  };
  const review = async (id, status) => {
    setBusy(true);
    try { await api.patch(`/billing/${id}/review`, { status, note: notes[id] || '' }); await load(); toast.success(`Payment ${status}`); }
    catch (err) { toast.error(err.response?.data?.error || 'Review failed'); }
    finally { setBusy(false); }
  };
  const download = async (path, name) => {
    try {
      const response = await api.get(path, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = url; link.download = `${name}.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error('Unable to download document'); }
  };
  const unique = [...new Map(payments.map((payment) => [payment.id, payment])).values()];
  const chart = ['pending', 'approved', 'rejected'].map((status) => ({ status, count: unique.filter((p) => p.status === status).length }));
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showSidebarToggle sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar role={user.role} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="md:ml-64 p-4 sm:p-8 max-w-screen-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{admin ? 'Payments, invoices & receipts' : 'My subscription & receipts'}</h1>
        <p className="text-gray-600 mb-6">{admin ? 'Review transactions, record school payments and issue verifiable student receipts.' : 'Submit your payment reference, track approval and download receipts paid by you or on your behalf.'}</p>
        {!admin && plan?.subscriptionExpiresAt && <p className="mb-6 text-sm">Subscription term ends: {new Date(plan.subscriptionExpiresAt).toLocaleDateString()}</p>}
        {!admin && plan?.sponsor?.name && <p className="card mb-4">Paid by: <strong>{plan.sponsor.name}</strong>{plan.sponsor.payer_details && ` · ${plan.sponsor.payer_details}`}. {plan.covered ? 'Your academic-year subscription is covered; no further payment is required.' : ''}</p>}
        {!admin && plan?.isAlumni && <p className="card mb-4">Alumni · Your counseling materials and counselor assignment remain available.</p>}
        {error && <div role="alert" className="p-4 mb-4 bg-red-50 text-red-800 rounded-lg">{error} <button onClick={load} className="underline">Retry</button></div>}
        {loading ? <p role="status">Loading billing…</p> : <>
          {admin && <section className="card mb-6" aria-label="Payment review chart">
            <h2 className="text-xl font-semibold mb-4">Transaction review overview</h2>
            <div className="grid sm:grid-cols-3 gap-4">{chart.map((item) => <div key={item.status}>
              <div className="flex justify-between mb-2"><span className="capitalize">{item.status}</span><strong>{item.count}</strong></div>
              <div className="h-3 rounded-full bg-gray-100"><div className={`h-3 rounded-full ${item.status === 'approved' ? 'bg-green-600' : item.status === 'pending' ? 'bg-amber-500' : 'bg-red-600'}`} style={{ width: `${unique.length ? item.count / unique.length * 100 : 0}%` }} /></div>
            </div>)}</div>
          </section>}
          <section className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">{admin ? 'Record individual / bulk payment or create invoice' : 'Submit subscription payment'}</h2>
            <p className="text-sm text-gray-600 mb-4">{plan?.instructions}</p>
            {!admin && !plan?.canPay ? <p role="status">{plan?.covered ? 'You are already covered for this academic year. Payments reopen after your coverage ends.' : plan?.pending ? 'A payment is awaiting review. Please do not pay again.' : plan?.invoicedBy ? `${plan.invoicedBy} has been invoiced on your behalf. Please do not pay separately.` : 'Payment availability is loading.'}</p> : !admin && !plan?.configured ? <p role="status">Subscription pricing has not been configured. Please contact an administrator.</p> : <form onSubmit={submit} className="space-y-4">
              {!admin && <p className="font-semibold">Subscription: {money(plan?.amountMinor, plan?.currency)} · {plan?.term}</p>}
               {admin && <>
                 <label className="block">Paying institution details (optional)<input className="input-field" maxLength={1000} value={payerDetails} onChange={event => setPayerDetails(event.target.value)} placeholder="Institution address / contact / sponsorship details" /></label>
                <label className="block">Existing school invoice (optional)
                  <select className="input-field mt-1" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}><option value="">No invoice — select students below</option>{invoices.filter((inv) => inv.status === 'issued').map((inv) => <option key={inv.id} value={inv.id}>{inv.school_name} — {money(inv.total_minor, inv.currency)}</option>)}</select>
                </label>
                {!invoiceId && <>
                  <fieldset className="border rounded-lg p-3"><legend className="px-2 font-medium">Students receiving this payment</legend>
                    <button type="button" className="underline text-sm mb-3" onClick={() => setSelected(selected.length === students.length ? [] : students.map((student) => student.id))}>Select / deselect all</button>
                    <div className="max-h-56 overflow-y-auto space-y-2">{students.map((student) => <label key={student.id} className="flex gap-3 items-center min-h-11"><input type="checkbox" checked={selected.includes(student.id)} onChange={() => setSelected(selected.includes(student.id) ? selected.filter((id) => id !== student.id) : [...selected, student.id])} /><span>{student.first_name} {student.last_name} · {student.school_name}</span></label>)}</div>
                    <p className="text-sm text-gray-600 mt-2">{selected.length} students selected</p>
                  </fieldset>
                  <div className="grid sm:grid-cols-2 gap-4"><label>Amount per student<input className="input-field" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Currency<select className="input-field" value={currency} onChange={(event) => setCurrency(event.target.value)}><option>USD</option><option>LRD</option></select></label></div>
                  <div className="grid sm:grid-cols-2 gap-4"><label>Paying institution / school name<input className="input-field" maxLength={200} value={schoolName} onChange={(event) => setSchoolName(event.target.value)} /></label><label>School contact email<input className="input-field" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label></div>
                  <button type="button" className="btn-secondary" disabled={busy || !selected.length || !schoolName} onClick={(event) => submit(event, true)}>Generate school invoice</button>
                </>}
              </>}
              <div className="grid sm:grid-cols-2 gap-4"><label>Payment method<select className="input-field" value={method} onChange={(event) => setMethod(event.target.value)}><option value="mobile_money">Mobile Money</option><option value="orange_money">Orange Money</option><option value="bank_transfer">Bank transfer</option><option value="visa">VISA (external merchant checkout)</option>{admin && <option value="cash">Cash</option>}</select></label><label>Payment / bank reference<input className="input-field" required maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} /></label></div>
              <p className="text-sm text-gray-600">This form records an external payment. It does not charge your account. All entries require administrator approval.</p>
              <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Submit for review'}</button>
            </form>}
          </section>
          <section className="space-y-4 mb-6"><h2 className="text-xl font-semibold">Transaction records</h2>
            {!payments.length && <p className="card">No payments recorded yet.</p>}
            {payments.map((payment) => <article className="card break-words" key={`${payment.id}-${payment.student_id}`}>
               <div className="flex flex-col sm:flex-row justify-between gap-3"><div><h3 className="font-semibold">{payment.student_name} · {money(payment.amount_minor, payment.currency)}</h3><p className="text-sm text-gray-600">Transaction #: {payment.reference}</p><p className="text-sm">{payment.method} · Provider reference: {payment.provider_reference}</p>{payment.payer_institution && <p className="text-sm">Paid by: {payment.payer_institution}</p>}{payment.receipt_reference && <p className="text-sm">Receipt #: {payment.receipt_reference}</p>}</div><strong className="capitalize">{payment.status}</strong></div>
              {payment.review_note && <p className="mt-3 text-sm">Review note: {payment.review_note}</p>}
              {payment.receipt_id && <button className="btn-secondary mt-3" onClick={() => download(`/billing/receipts/${payment.receipt_id}/download`, payment.receipt_reference)}>Download receipt</button>}
              {admin && payment.status === 'pending' && <div className="mt-4 space-y-3"><label className="block">Review note (required)<input className="input-field" maxLength={1000} value={notes[payment.id] || ''} onChange={(event) => setNotes({ ...notes, [payment.id]: event.target.value })} /></label><div className="flex flex-wrap gap-3"><button disabled={busy} className="btn-primary" onClick={() => review(payment.id, 'approved')}>Approve payment</button><button disabled={busy} className="btn-secondary" onClick={() => review(payment.id, 'rejected')}>Reject payment</button></div><p className="text-sm text-gray-600">For bulk entries, review applies to the entire transaction and all its students.</p></div>}
            </article>)}
          </section>
          {admin && <section className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">School invoices</h2>
            <p className="text-sm mb-4">Download a PDF, or send it using the configured invoice email provider.</p>
            <div className="space-y-4">{invoices.map((invoice) => <div key={invoice.id} className="border rounded-lg p-3 break-words">
              <p>{invoice.school_name} · {money(invoice.total_minor, invoice.currency)} · {invoice.status}</p>
               <small>Invoice #: {invoice.reference}</small>
              <div className="flex flex-wrap gap-3 mt-3">
                 <button className="btn-secondary" onClick={() => download(`/billing/invoices/${invoice.id}/download`, invoice.reference)}>Download invoice</button>
                 {invoice.status === 'issued' && <button className="btn-secondary" disabled={busy} onClick={async () => { try { await api.patch(`/billing/invoices/${invoice.id}/cancel`); await load(); toast.success('Invoice cancelled'); } catch (err) { toast.error(err.response?.data?.error || 'Unable to cancel invoice'); } }}>Cancel invoice</button>}
                {invoice.contact_email && <button className="btn-secondary" disabled={busy} onClick={async () => { setBusy(true); try { const response = await api.post(`/billing/invoices/${invoice.id}/send`); toast.success(response.data.message); } catch (err) { toast.error(err.response?.data?.error || 'Unable to send invoice'); } finally { setBusy(false); } }}>Email to school</button>}
              </div>
            </div>)}</div>
          </section>}
          <section className="card"><h2 className="text-xl font-semibold mb-4">Verify a receipt, transaction or invoice number</h2><form className="flex flex-col sm:flex-row gap-3" onSubmit={async (event) => { event.preventDefault(); setVerified(null); try { const response = await api.get(`/billing/verify/${encodeURIComponent(verify.trim())}`); setVerified(response.data.document); } catch { toast.error('Reference not found'); } }}><input aria-label="Receipt, transaction or invoice number" className="input-field" value={verify} onChange={(event) => setVerify(event.target.value)} required /><button className="btn-primary">Verify</button></form>{verified && <p className="mt-3 break-words" role="status">Verified {verified.kind} #: {verified.reference} · {verified.status}</p>}</section>
        </>}
      </main>
    </div>
  );
}
