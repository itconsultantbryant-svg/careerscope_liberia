import express from 'express';
import multer from 'multer';
import { query } from '../db/postgres.js';
import { authenticate } from '../middleware/pg-auth.js';
import { fail } from '../services/notifications.js';

const router=express.Router();
router.use(authenticate);
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1}});
const validId=(id)=>{if(!/^[0-9a-f-]{36}$/i.test(id)) throw fail(400,'Invalid document identifier');return id;};
router.get('/',async(req,res)=>{
  const documents=(await query('SELECT id,title,kind,room_id,original_name,mime_type,octet_length(file_content) AS size,created_at,updated_at FROM archive_documents WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 1000',[req.user.id])).rows;
  res.json({documents});
});
router.post('/',async(req,res)=>{
  const title=String(req.body.title||'').trim().slice(0,200),content=String(req.body.content||'');
  if(!title || content.length>100000) throw fail(400,'A title and a note of at most 100,000 characters are required');
  const roomId=req.body.roomId?validId(req.body.roomId):null;
  if(roomId && !(await query('SELECT user_id FROM call_room_members WHERE room_id=$1 AND user_id=$2 AND first_joined_at IS NOT NULL',[roomId,req.user.id])).rowCount) throw fail(403,'Only class participants can save class notes');
  const kind=roomId?'call_note':'note';
  const document=(await query(`INSERT INTO archive_documents(owner_id,title,kind,content,room_id) VALUES($1,$2,$3,$4,$5) ${roomId?"ON CONFLICT(owner_id,room_id,kind) WHERE room_id IS NOT NULL AND kind IN ('call_note','transcript') DO UPDATE SET content=EXCLUDED.content,title=EXCLUDED.title,updated_at=now()":''} RETURNING id`,[req.user.id,title,kind,content,roomId])).rows[0];
  res.status(201).json({document});
});
router.post('/upload',upload.single('file'),async(req,res)=>{
  const file=req.file;
  if(!file) throw fail(400,'Choose a document');
  if(!['application/pdf','text/plain','image/png','image/jpeg','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.mimetype)) throw fail(400,'Upload PDF, text, image, DOCX or XLSX files');
  const title=String(req.body.title||file.originalname).slice(0,200);
  const document=(await query("INSERT INTO archive_documents(owner_id,title,kind,file_content,mime_type,original_name) VALUES($1,$2,'file',$3,$4,$5) RETURNING id",[req.user.id,title,file.buffer,file.mimetype,file.originalname.slice(0,200)])).rows[0];
  res.status(201).json({document});
});
router.get('/:id',async(req,res)=>{
  const document=(await query('SELECT id,title,kind,content,room_id FROM archive_documents WHERE id=$1 AND owner_id=$2',[validId(req.params.id),req.user.id])).rows[0];
  if(!document) throw fail(404,'Document not found');
  res.json({document});
});
router.get('/:id/download',async(req,res)=>{
  const document=(await query('SELECT * FROM archive_documents WHERE id=$1 AND owner_id=$2',[validId(req.params.id),req.user.id])).rows[0];
  if(!document) throw fail(404,'Document not found');
  const name=(document.original_name||`${document.title}.txt`).replace(/[^a-zA-Z0-9._ -]/g,'_');
  const view=req.query.view==='1'&&['application/pdf','image/png','image/jpeg','image/webp','text/plain'].includes(document.mime_type);
  res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
  res.setHeader('Content-Disposition',`${view?'inline':'attachment'}; filename="${name}"`);
  res.type(document.mime_type||'text/plain').send(document.file_content||document.content);
});
router.delete('/:id',async(req,res)=>{
  if(!(await query('DELETE FROM archive_documents WHERE id=$1 AND owner_id=$2',[validId(req.params.id),req.user.id])).rowCount) throw fail(404,'Document not found');
  res.json({deleted:true});
});
export default router;
