import { useState, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Calendar as CalendarIcon, Clock, Users, FileText, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

const localizer = momentLocalizer(moment);

export default function CalendarView({ 
  schedules = [], 
  appointments = [], 
  sessions = [], 
  role = 'student',
  onSelectEvent 
}) {
  const [view, setView] = useState('month');
  const [date, setDate] = useState(new Date());

  // Transform data into calendar events
  const events = useMemo(() => {
    const eventList = [];

    // Add schedules as recurring weekly events
    schedules.forEach((schedule) => {
      if (schedule.status === 'accepted' || schedule.status === 'active') {
        // Get next 3 months of occurrences
        const startDate = moment(date).startOf('month');
        const endDate = moment(date).add(3, 'months').endOf('month');
        
        // Map day names to moment day indices (0=Sunday, 1=Monday, etc.)
        const dayMap = {
          'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
          'Thursday': 4, 'Friday': 5, 'Saturday': 6
        };
        const dayIndex = dayMap[schedule.day_of_week] ?? 1;
        
        // Find first occurrence of this day in the month
        let scheduleDate = startDate.clone().day(dayIndex);
        if (scheduleDate.isBefore(startDate)) {
          scheduleDate.add(1, 'week');
        }
        
        // Generate occurrences for the next 3 months
        while (scheduleDate.isBefore(endDate)) {
          if (scheduleDate.isSameOrAfter(startDate)) {
            const [startHour, startMinute] = schedule.start_time.split(':');
            const [endHour, endMinute] = schedule.end_time.split(':');
            
            const eventStart = scheduleDate.clone()
              .hour(parseInt(startHour))
              .minute(parseInt(startMinute))
              .second(0);
            
            const eventEnd = scheduleDate.clone()
              .hour(parseInt(endHour))
              .minute(parseInt(endMinute))
              .second(0);

            eventList.push({
              id: `schedule-${schedule.id}-${scheduleDate.format('YYYY-MM-DD')}`,
              title: role === 'student' 
                ? `📅 Schedule: ${schedule.counselor_name || 'Counselor'}`
                : `📅 Schedule: ${schedule.student_name || 'Student'}`,
              start: eventStart.toDate(),
              end: eventEnd.toDate(),
              resource: {
                type: 'schedule',
                data: schedule,
                color: '#3B82F6', // Blue
              },
            });
          }
          scheduleDate.add(1, 'week');
        }
      }
    });

    // Add appointments
    appointments.forEach((apt) => {
      if (apt.status === 'accepted' || apt.status === 'pending') {
        const [year, month, day] = apt.appointment_date.split('-');
        const [hour, minute] = apt.appointment_time.split(':');
        
        const start = moment()
          .year(parseInt(year))
          .month(parseInt(month) - 1)
          .date(parseInt(day))
          .hour(parseInt(hour))
          .minute(parseInt(minute))
          .second(0)
          .toDate();
        
        const end = moment(start).add(1, 'hour').toDate();

        eventList.push({
          id: `appointment-${apt.id}`,
          title: role === 'student'
            ? `📞 Appointment: ${apt.counselor_name || 'Counselor'}`
            : `📞 Appointment: ${apt.student_name || 'Student'}`,
          start,
          end,
          resource: {
            type: 'appointment',
            data: apt,
            color: apt.status === 'accepted' ? '#10B981' : '#F59E0B', // Green or Yellow
          },
        });
      }
    });

    // Add live sessions
    sessions.forEach((session) => {
      if (session.status === 'active' || session.status === 'scheduled') {
        const start = new Date(session.start_time);
        const end = session.end_time ? new Date(session.end_time) : moment(start).add(1, 'hour').toDate();

        eventList.push({
          id: `session-${session.id}`,
          title: role === 'student'
            ? `💬 Session: ${session.counselor_name || 'Counselor'}`
            : `💬 Session: ${session.student_name || 'Student'}`,
          start,
          end,
          resource: {
            type: 'session',
            data: session,
            color: session.status === 'active' ? '#EF4444' : '#8B5CF6', // Red or Purple
          },
        });
      }
    });

    return eventList;
  }, [schedules, appointments, sessions, date, role]);

  // Custom event style
  const eventStyleGetter = (event) => {
    const backgroundColor = event.resource?.color || '#3B82F6';
    const style = {
      backgroundColor,
      borderRadius: '5px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: '500',
      padding: '2px 4px',
    };
    return { style };
  };

  // Custom toolbar with view switcher
  const CustomToolbar = ({ label, onNavigate, onView }) => {
    return (
      <div className="flex items-center justify-between mb-4 p-4 bg-white rounded-lg shadow-sm">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onNavigate('PREV')}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
          >
            ‹ Prev
          </button>
          <button
            onClick={() => onNavigate('TODAY')}
            className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
          >
            Today
          </button>
          <button
            onClick={() => onNavigate('NEXT')}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
          >
            Next ›
          </button>
        </div>
        <h2 className="text-xl font-bold text-gray-900">{label}</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onView('month')}
            className={`px-4 py-2 rounded-lg font-medium ${
              view === 'month' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => onView('week')}
            className={`px-4 py-2 rounded-lg font-medium ${
              view === 'week' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => onView('day')}
            className={`px-4 py-2 rounded-lg font-medium ${
              view === 'day' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Day
          </button>
        </div>
      </div>
    );
  };

  // Custom event component
  const CustomEvent = ({ event }) => {
    const icon = event.resource?.type === 'schedule' ? CalendarIcon :
                 event.resource?.type === 'appointment' ? Clock :
                 MessageSquare;
    const Icon = icon;

    return (
      <div className="flex items-start space-x-2 p-1">
        <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{event.title}</div>
          {event.resource?.data && (
            <div className="text-xs opacity-90 truncate">
              {moment(event.start).format('h:mm A')} - {moment(event.end).format('h:mm A')}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2 flex items-center space-x-2">
          <CalendarIcon className="w-6 h-6" />
          <span>Calendar View</span>
        </h2>
        <p className="text-gray-600">
          Track your schedules, appointments, and sessions in real-time
        </p>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3B82F6' }}></div>
          <span className="text-sm text-gray-700">Schedules</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10B981' }}></div>
          <span className="text-sm text-gray-700">Accepted Appointments</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#F59E0B' }}></div>
          <span className="text-sm text-gray-700">Pending Appointments</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#EF4444' }}></div>
          <span className="text-sm text-gray-700">Active Sessions</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#8B5CF6' }}></div>
          <span className="text-sm text-gray-700">Scheduled Sessions</span>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ height: '600px' }} className="bg-white rounded-lg p-4">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          onSelectEvent={onSelectEvent}
          eventPropGetter={eventStyleGetter}
          components={{
            toolbar: CustomToolbar,
            event: CustomEvent,
          }}
          popup
          className="rbc-calendar"
        />
      </div>

      {/* Event Count Summary */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {schedules.filter(s => s.status === 'accepted' || s.status === 'active').length}
              </p>
              <p className="text-sm text-gray-600">Active Schedules</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-600">
                {appointments.filter(a => a.status === 'accepted').length}
              </p>
              <p className="text-sm text-gray-600">Accepted Appointments</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {sessions.filter(s => s.status === 'active').length}
              </p>
              <p className="text-sm text-gray-600">Active Sessions</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

