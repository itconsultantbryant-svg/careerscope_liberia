import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Chat from '../components/Chat';
import { MessageSquare, Search, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ChatPage() {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
    fetchStudents();
    
    // Poll for new conversations every 10 seconds
    const interval = setInterval(() => {
      fetchConversations();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/messages/conversations');
      setConversations(res.data.conversations || []);
    } catch (error) {
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await api.get('/users/students/list');
      setStudents(res.data.students || []);
    } catch (error) {
      console.error('Failed to fetch students');
    }
  };

  const startNewConversation = (student) => {
    setSelectedUser(student);
  };

  const filteredStudents = students.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredConversations = conversations.filter(c =>
    c.other_user_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="flex h-[calc(100vh-64px)]">
        {/* Conversations List */}
        <div className="w-full md:w-96 bg-white border-r flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Messages</h2>
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{isConnected ? 'Live' : 'Offline'}</span>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* New Chat Button */}
          <div className="p-4 border-b">
            <button
              onClick={() => setSelectedUser(null)}
              className="w-full btn-primary flex items-center justify-center space-x-2"
            >
              <MessageSquare className="w-5 h-5" />
              <span>New Message</span>
            </button>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <>
                {filteredConversations.length > 0 && (
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Recent</p>
                    {filteredConversations.map((conv) => (
                      <motion.div
                        key={conv.other_user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => setSelectedUser({
                          id: conv.other_user_id,
                          first_name: conv.other_user_name.split(' ')[0],
                          last_name: conv.other_user_name.split(' ').slice(1).join(' '),
                          profile_image: conv.other_user_image,
                        })}
                        className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors ${
                          selectedUser?.id === conv.other_user_id ? 'bg-primary-50 border border-primary-200' : ''
                        }`}
                      >
                        <div className="w-12 h-12 bg-primary-200 rounded-full flex items-center justify-center flex-shrink-0">
                          {conv.other_user_image ? (
                            <img src={conv.other_user_image} alt={conv.other_user_name} className="w-12 h-12 rounded-full" />
                          ) : (
                            <span className="text-primary-600 font-semibold">
                              {conv.other_user_name?.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-gray-900 truncate">{conv.other_user_name}</p>
                            {conv.unread_count > 0 && (
                              <span className="bg-primary-600 text-white text-xs rounded-full px-2 py-0.5">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate">{conv.last_message}</p>
                          <p className="text-xs text-gray-500">
                            {conv.last_message_time ? new Date(conv.last_message_time).toLocaleDateString() : ''}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Available Students */}
                {!selectedUser && (
                  <div className="p-2 border-t">
                    <p className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2 flex items-center space-x-2">
                      <Users className="w-4 h-4" />
                      <span>Start New Conversation</span>
                    </p>
                    {filteredStudents.length === 0 ? (
                      <p className="text-sm text-gray-500 px-2">No students found</p>
                    ) : (
                      filteredStudents.map((student) => (
                        <motion.div
                          key={student.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => startNewConversation(student)}
                          className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                        >
                          <div className="w-12 h-12 bg-primary-200 rounded-full flex items-center justify-center flex-shrink-0">
                            {student.profile_image ? (
                              <img src={student.profile_image} alt={student.first_name} className="w-12 h-12 rounded-full" />
                            ) : (
                              <span className="text-primary-600 font-semibold">
                                {student.first_name?.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900">
                              {student.first_name} {student.last_name}
                            </p>
                            <p className="text-sm text-gray-600">{student.school_name}</p>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedUser ? (
            <Chat selectedUser={selectedUser} onClose={() => setSelectedUser(null)} />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MessageSquare className="w-24 h-24 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a conversation</h3>
                <p className="text-gray-500">Choose a student to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

