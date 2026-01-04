import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { toast } from 'sonner';
import EmojiPicker from 'emoji-picker-react';
import {
  Send, Image as ImageIcon, Paperclip, Mic, Phone, Video,
  X, Smile, ThumbsUp, Heart, Smile as SmileIcon, Frown, Angry, Meh,
  MoreVertical, Reply, Download, Play, Pause, Users, RotateCcw, History, PhoneOff, PhoneIncoming, PhoneOutgoing
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const REACTIONS = [
  { name: 'like', icon: ThumbsUp, emoji: '👍' },
  { name: 'love', icon: Heart, emoji: '❤️' },
  { name: 'laugh', icon: SmileIcon, emoji: '😂' },
  { name: 'wow', icon: Meh, emoji: '😮' },
  { name: 'sad', icon: Frown, emoji: '😢' },
  { name: 'angry', icon: Angry, emoji: '😠' },
];

export default function Chat({ selectedUser, onClose }) {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [reactionMenu, setReactionMenu] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isGroupCall, setIsGroupCall] = useState(false);
  const [groupCallParticipants, setGroupCallParticipants] = useState([]);
  const [peerConnections, setPeerConnections] = useState(new Map());
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [callStatus, setCallStatus] = useState('ringing'); // 'calling', 'ringing', 'connecting', 'ongoing', 'ended'
  const [isCaller, setIsCaller] = useState(false);
  const [callHistory, setCallHistory] = useState([]);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // 'user' (front) or 'environment' (back)
  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCallData, setIncomingCallData] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteVideosRef = useRef(new Map());
  const audioRef = useRef(null);
  const emojiPickerRef = useRef(null);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
      fetchCallHistory();
      const convId = [user.id, selectedUser.id].sort().join('_');
      setConversationId(convId);
      
      if (socket) {
        socket.emit('join_conversation', convId);
        
        socket.on('new_message', (message) => {
          if (message.senderId === selectedUser.id || message.receiverId === selectedUser.id || 
              message.sender_id === selectedUser.id || message.receiver_id === selectedUser.id) {
            setMessages(prev => {
              const exists = prev.some(m => m.id === message.id || m.id === message.messageId);
              if (exists) return prev;
              return [...prev, message];
            });
            scrollToBottom();
          }
        });

        socket.on('user_typing', (data) => {
          if (data.userId === selectedUser.id) {
            setIsTyping(data.isTyping);
            setTimeout(() => setIsTyping(false), 3000);
          }
        });

        socket.on('incoming_call', (data) => {
          if (data.from === selectedUser.id) {
            handleIncomingCall(data);
          }
        });

        socket.on('call_answered', (data) => {
          if (data.from === selectedUser.id) {
            handleCallAnswer(data);
          }
        });

        socket.on('call_ended', (data) => {
          if (data.from === selectedUser.id) {
            handleCallEnd();
          }
        });

        socket.on('ice_candidate', (data) => {
          handleIceCandidate(data);
        });

        socket.on('group_call_invite', (data) => {
          handleGroupCallInvite(data);
        });
      }
    }

    return () => {
      if (socket && conversationId) {
        socket.emit('leave_conversation', conversationId);
        socket.off('new_message');
        socket.off('user_typing');
        socket.off('incoming_call');
        socket.off('call_answered');
        socket.off('call_ended');
        socket.off('ice_candidate');
        socket.off('group_call_invite');
      }
    };
  }, [selectedUser, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/messages/${selectedUser.id}`);
      setMessages(res.data.messages || []);
    } catch (error) {
      toast.error('Failed to load messages');
    }
  };

  const sendMessage = async (content = null, messageType = 'text', attachment = null) => {
    if (!content && !attachment) return;

    try {
      const formData = new FormData();
      if (content) formData.append('content', content);
      if (attachment) formData.append('attachment', attachment);
      formData.append('receiverId', String(selectedUser.id));
      formData.append('messageType', messageType);
      if (replyTo) formData.append('replyToMessageId', String(replyTo.id));

      const res = await api.post('/messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const messageData = {
        ...res.data.messageData,
        sender_id: res.data.messageData.sender_id || user.id,
        receiver_id: res.data.messageData.receiver_id || selectedUser.id,
      };

      if (socket) {
        socket.emit('send_message', {
          ...messageData,
          senderId: messageData.sender_id,
          receiverId: messageData.receiver_id,
        });
      }

      setMessages(prev => {
        const exists = prev.some(m => m.id === messageData.id);
        if (exists) return prev;
        return [...prev, messageData];
      });
      setNewMessage('');
      setReplyTo(null);
      setAudioBlob(null);
      scrollToBottom();
    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || 'Failed to send message';
      toast.error(errorMessage);
    }
  };

  const handleTyping = (isTyping) => {
    if (socket && !typing && isTyping) {
      setTyping(true);
      socket.emit('typing', {
        senderId: user.id,
        receiverId: selectedUser.id,
        isTyping: true,
      });
    } else if (socket && typing && !isTyping) {
      setTyping(false);
      socket.emit('typing', {
        senderId: user.id,
        receiverId: selectedUser.id,
        isTyping: false,
      });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          stream.getTracks().forEach(track => track.stop());
          // Auto-send voice message
          sendMessage(null, 'voice', blob);
        }
      };

      recorder.start(100); // Collect data every 100ms for real-time
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (error) {
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
      setMediaRecorder(null);
    }
  };

  // Voice messages auto-send when recording stops

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const maxWidth = 1920;
          const maxHeight = 1080;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            } else {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Compression failed'));
              }
            },
            'image/jpeg',
            0.9
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleFileSelect = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === 'image' && file.size > 2 * 1024 * 1024) {
        try {
          const compressedFile = await compressImage(file);
          sendMessage(null, 'image', compressedFile);
        } catch (error) {
          console.error('Image compression failed:', error);
          sendMessage(null, 'image', file);
        }
      } else {
        sendMessage(null, type === 'image' ? 'image' : 'document', file);
      }
      e.target.value = '';
    }
  };

  const addReaction = async (messageId, reaction) => {
    try {
      await api.post(`/messages/${messageId}/reaction`, { reaction });
      fetchMessages();
      setReactionMenu(null);
    } catch (error) {
      toast.error('Failed to add reaction');
    }
  };

  const removeReaction = async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}/reaction`);
      fetchMessages();
    } catch (error) {
      toast.error('Failed to remove reaction');
    }
  };

  const createPeerConnection = (userId, isInitiator = false) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (isGroupCall) {
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            newMap.set(userId, stream);
            return newMap;
          });
        } else {
          setRemoteStream(stream);
          if (callStatus !== 'ongoing') {
            setCallStatus('ongoing');
          }
          // Update remote video when stream is received
          setTimeout(() => {
            if (remoteVideoRef.current && callType === 'video') {
              remoteVideoRef.current.srcObject = stream;
              remoteVideoRef.current.play().catch(err => {
                console.error('Error playing remote video:', err);
              });
            }
          }, 100);
        }
      };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice_candidate', {
          to: userId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        pc.close();
        if (isGroupCall) {
          setPeerConnections(prev => {
            const newMap = new Map(prev);
            newMap.delete(userId);
            return newMap;
          });
        }
      }
    };

    return pc;
  };

  const startCall = async (type, isGroup = false) => {
    try {
      const constraints = {
        video: type === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setCallType(type);
      setInCall(true);
      setIsGroupCall(isGroup);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      if (isGroup) {
        // Group call logic
        toast.info('Group call feature - add participants');
      } else {
        // One-on-one call
        const pc = createPeerConnection(selectedUser.id, true);
        setPeerConnection(pc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (socket) {
          socket.emit('call_signal', {
            to: selectedUser.id,
            signal: offer,
            type,
          });
        }
      }
    } catch (error) {
      toast.error('Failed to start call');
      console.error('Call error:', error);
    }
  };

  const handleIncomingCall = async (data) => {
    setCallType(data.type);
    setInCall(true);
    setIsCaller(false);
    setCallStatus('ringing');
    setIncomingCallData(data); // Store call data for accept button
    
    // Create call history entry for incoming call
    try {
      await api.post('/calls/history', {
        callerId: selectedUser.id,
        callType: data.type,
        status: 'ongoing'
      });
    } catch (err) {
      console.error('Failed to create call history:', err);
    }
    
    // The UI will show accept/reject buttons - no need for confirm dialog
  };

  const answerCall = async (data) => {
    try {
      setCallStatus('connecting');
      setCallStartTime(Date.now());
      setCallDuration(0);
      
      const constraints = {
        video: data.type === 'video' ? {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, min: 24 },
          facingMode: facingMode,
          aspectRatio: 16/9
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setCallType(data.type);
      setInCall(true);
      setIsCaller(false);

      // Set local video stream when answering
      if (data.type === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection(selectedUser.id, false);
      setPeerConnection(pc);

      await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socket) {
        socket.emit('call_answer', {
          to: selectedUser.id,
          signal: answer,
        });
      }
      
      setCallStatus('ongoing');
      
      // Update call history to answered
      try {
        await api.patch('/calls/history/latest', {
          status: 'answered'
        });
      } catch (err) {
        console.error('Failed to update call history:', err);
      }
    } catch (error) {
      toast.error('Failed to answer call');
      console.error('Answer call error:', error);
      endCall();
    }
  };

  const handleCallAnswer = async (data) => {
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
        setCallStatus('ongoing');
        setCallStartTime(Date.now());
        setCallDuration(0);
        
        // Update call history to answered
        try {
          await api.patch('/calls/history/latest', {
            status: 'answered'
          });
        } catch (err) {
          console.error('Failed to update call history:', err);
        }
      } catch (error) {
        console.error('Error setting remote description:', error);
      }
    }
  };

  const handleIceCandidate = async (data) => {
    if (peerConnection && data.candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  const handleGroupCallInvite = (data) => {
    // Handle group call invitation
    toast.info(`Group call invitation from ${data.from}`);
  };

  const handleCallEnd = () => {
    endCall();
  };

  const endCall = async () => {
    const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
    
    // Update call history
    try {
      await api.patch('/calls/history/latest', {
        status: callStatus === 'ongoing' ? 'answered' : 'cancelled',
        duration: duration,
        endedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to update call history:', err);
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    remoteStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    setRemoteStreams(new Map());
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    peerConnections.forEach(pc => pc.close());
    setPeerConnections(new Map());
    if (socket) {
      socket.emit('call_end', { to: selectedUser.id });
    }
    setInCall(false);
    setCallType(null);
    setIsGroupCall(false);
    setGroupCallParticipants([]);
    setCallStatus('ended');
    setIsCaller(false);
    setCallStartTime(null);
    setCallDuration(0);
    
    // Refresh call history
    fetchCallHistory();
  };
  
  const rejectCall = async () => {
    try {
      await api.patch('/calls/history/latest', {
        status: 'rejected'
      });
    } catch (err) {
      console.error('Failed to update call history:', err);
    }
    endCall();
  };
  
  const fetchCallHistory = async () => {
    try {
      const res = await api.get(`/calls/history/${selectedUser.id}`);
      setCallHistory(res.data.calls || []);
    } catch (error) {
      console.error('Failed to fetch call history:', error);
    }
  };
  
  const switchCamera = async () => {
    if (!localStream || callType !== 'video') return;
    
    try {
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(newFacingMode);
      
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        const constraints = {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, min: 24 },
          facingMode: newFacingMode,
          aspectRatio: 16/9
        };
        
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: constraints,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 2
          }
        });
        
        // Replace video track
        const newVideoTrack = newStream.getVideoTracks()[0];
        const sender = peerConnection?.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender && newVideoTrack) {
          await sender.replaceTrack(newVideoTrack);
          videoTrack.stop();
          
          // Update local stream
          localStream.removeTrack(videoTrack);
          localStream.addTrack(newVideoTrack);
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
        }
        
        // Stop audio tracks from new stream (we only need video)
        newStream.getAudioTracks().forEach(track => track.stop());
      }
    } catch (error) {
      console.error('Error switching camera:', error);
      toast.error('Failed to switch camera');
    }
  };

  // Update call duration timer
  useEffect(() => {
    let interval = null;
    if (callStatus === 'ongoing' && callStartTime) {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus, callStartTime]);

  const playAudio = (audioUrl) => {
    if (!audioUrl) {
      toast.error('Audio URL not available');
      return;
    }

    if (playingAudio === audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingAudio(null);
      }
    } else {
      if (audioRef.current) {
        // Ensure URL is absolute
        const fullUrl = audioUrl.startsWith('http') 
          ? audioUrl 
          : `http://localhost:5000${audioUrl}`;
        
        audioRef.current.src = fullUrl;
        audioRef.current.load(); // Reload the audio element
        
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setPlayingAudio(audioUrl);
            })
            .catch((error) => {
              console.error('Error playing audio:', error);
              toast.error('Failed to play audio');
              setPlayingAudio(null);
            });
        }
        
        audioRef.current.onended = () => setPlayingAudio(null);
        audioRef.current.onerror = (error) => {
          console.error('Audio playback error:', error);
          toast.error('Audio playback failed');
          setPlayingAudio(null);
        };
      }
    }
  };

  const onEmojiClick = (emojiData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-3">
          <button onClick={onClose} className="md:hidden">
            <X className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-primary-200 rounded-full flex items-center justify-center">
            {selectedUser.profile_image ? (
              <img 
                src={selectedUser.profile_image.startsWith('http') ? selectedUser.profile_image : `http://localhost:5000${selectedUser.profile_image}`} 
                alt={selectedUser.first_name} 
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextElementSibling) {
                    e.target.nextElementSibling.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            {!selectedUser.profile_image && (
              <span className="text-primary-600 font-semibold">
                {selectedUser.first_name?.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <p className="font-semibold">{selectedUser.first_name} {selectedUser.last_name}</p>
            <p className="text-xs text-gray-500">
              {isTyping ? 'typing...' : isConnected ? 'online' : 'offline'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCallHistory(!showCallHistory)}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
            title="Call History"
          >
            <History className="w-5 h-5" />
          </button>
          <button
            onClick={() => startCall('voice', false)}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
            title="Voice Call"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={() => startCall('video', false)}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
            title="Video Call"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            onClick={() => startCall('video', true)}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
            title="Group Call"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Call Interface */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black z-50 flex flex-col"
          >
            <div className="flex-1 relative">
              {callType === 'video' && (
                <>
                  {isGroupCall ? (
                    <div className="grid grid-cols-2 gap-2 p-4 h-full">
                      <div className="relative">
                        {localStream ? (
                          <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                            <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center">
                              <span className="text-3xl font-bold text-white">
                                {user?.first_name?.charAt(0)}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
                          You
                        </div>
                      </div>
                      {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
                        <div key={userId} className="relative">
                          <video
                            ref={(el) => {
                              if (el) {
                                el.srcObject = stream;
                                remoteVideosRef.current.set(userId, el);
                              }
                            }}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {/* Remote video (full screen) */}
                      {remoteStream && callStatus === 'connected' ? (
                        <video
                          ref={remoteVideoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                          <div className="text-center text-white">
                            <div className="w-40 h-40 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                              {selectedUser.profile_image ? (
                                <img 
                                  src={selectedUser.profile_image.startsWith('http') ? selectedUser.profile_image : `http://localhost:5000${selectedUser.profile_image}`} 
                                  alt={selectedUser.first_name} 
                                  className="w-40 h-40 rounded-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextElementSibling) {
                                      e.target.nextElementSibling.style.display = 'flex';
                                    }
                                  }}
                                />
                              ) : null}
                              {!selectedUser.profile_image && (
                                <span className="text-5xl font-bold">
                                  {selectedUser.first_name?.charAt(0)}
                                </span>
                              )}
                            </div>
                            <p className="text-2xl font-semibold">
                              {selectedUser.first_name} {selectedUser.last_name}
                            </p>
                            <p className="text-gray-400 mt-2">
                              {callStatus === 'ringing' ? (isCaller ? 'Calling...' : 'Incoming call...') : 'Connecting...'}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Local video (picture-in-picture) */}
                      {localStream && (
                        <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg">
                          {callType === 'video' ? (
                            <video
                              ref={localVideoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-primary-600 flex items-center justify-center">
                              {user?.profile_image ? (
                                <img 
                                  src={user.profile_image.startsWith('http') ? user.profile_image : `http://localhost:5000${user.profile_image}`} 
                                  alt={user.first_name} 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextElementSibling) {
                                      e.target.nextElementSibling.style.display = 'flex';
                                    }
                                  }}
                                />
                              ) : null}
                              {!user?.profile_image && (
                                <span className="text-2xl font-bold text-white">
                                  {user?.first_name?.charAt(0)}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="absolute bottom-1 left-1 text-white text-xs bg-black/50 px-2 py-0.5 rounded">
                            You
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {callType === 'voice' && (
                <div className="flex items-center justify-center h-full">
                  <div className="grid grid-cols-2 gap-8 max-w-2xl w-full px-8">
                    {/* Caller profile */}
                    <div className="text-center text-white">
                      <div className="w-32 h-32 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
                        {user?.profile_image ? (
                          <img 
                            src={user.profile_image.startsWith('http') ? user.profile_image : `http://localhost:5000${user.profile_image}`} 
                            alt={user.first_name} 
                            className="w-32 h-32 rounded-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextElementSibling) {
                                e.target.nextElementSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        {!user?.profile_image && (
                          <span className="text-4xl font-bold">
                            {user?.first_name?.charAt(0)}
                          </span>
                        )}
                      </div>
                      <p className="text-xl font-semibold">You</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {callStatus === 'calling' ? 'Calling...' : 
                         callStatus === 'ringing' ? 'Ringing...' : 
                         callStatus === 'connecting' ? 'Connecting...' : 
                         callStatus === 'ongoing' ? `Ongoing - ${Math.floor(callDuration / 60)}:${String(callDuration % 60).padStart(2, '0')}` : 
                         'Connected'}
                      </p>
                    </div>
                    
                    {/* Receiver profile */}
                    <div className="text-center text-white">
                      <div className="w-32 h-32 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
                        {selectedUser.profile_image ? (
                          <img 
                            src={selectedUser.profile_image.startsWith('http') ? selectedUser.profile_image : `http://localhost:5000${selectedUser.profile_image}`} 
                            alt={selectedUser.first_name} 
                            className="w-32 h-32 rounded-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextElementSibling) {
                                e.target.nextElementSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        {!selectedUser.profile_image && (
                          <span className="text-4xl font-bold">
                            {selectedUser.first_name?.charAt(0)}
                          </span>
                        )}
                      </div>
                      <p className="text-xl font-semibold">
                        {selectedUser.first_name} {selectedUser.last_name}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {callStatus === 'calling' ? 'Calling...' : 
                         callStatus === 'ringing' ? (isCaller ? 'Ringing...' : 'Incoming call') : 
                         callStatus === 'connecting' ? 'Connecting...' : 
                         callStatus === 'ongoing' ? `Ongoing - ${Math.floor(callDuration / 60)}:${String(callDuration % 60).padStart(2, '0')}` : 
                         'Connected'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center space-x-4 p-6 bg-gray-900">
              {/* Show accept/reject buttons for incoming calls */}
              {!isCaller && callStatus === 'ringing' ? (
                <>
                  <button
                    onClick={rejectCall}
                    className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                    title="Reject"
                  >
                    <PhoneOff className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={() => {
                      if (incomingCallData) {
                        answerCall(incomingCallData);
                        setIncomingCallData(null);
                      }
                    }}
                    className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center hover:bg-green-700 transition-colors"
                    title="Accept"
                  >
                    <Phone className="w-6 h-6 text-white" />
                  </button>
                </>
              ) : (
                <>
                  {/* Camera switch button for video calls */}
                  {callType === 'video' && callStatus === 'ongoing' && (
                    <button
                      onClick={switchCamera}
                      className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
                      title="Switch Camera"
                    >
                      <RotateCcw className="w-5 h-5 text-white" />
                    </button>
                  )}
                  <button
                    onClick={endCall}
                    className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                    title="End Call"
                  >
                    <Phone className="w-6 h-6 text-white rotate-[135deg]" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages
          .filter((message, index, self) => 
            index === self.findIndex(m => m.id === message.id)
          )
          .map((message, index) => (
          <div
            key={message.id || `message-${index}-${message.created_at}`}
            className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start space-x-2 max-w-[70%] ${message.sender_id === user.id ? 'flex-row-reverse space-x-reverse' : ''}`}>
              {message.sender_id !== user.id && (
                <div className="w-8 h-8 bg-primary-200 rounded-full flex items-center justify-center flex-shrink-0">
                  {message.sender_image ? (
                    <img src={message.sender_image} alt={message.sender_name} className="w-8 h-8 rounded-full" />
                  ) : (
                    <span className="text-primary-600 text-xs font-semibold">
                      {message.sender_name?.charAt(0)}
                    </span>
                  )}
                </div>
              )}
              <div
                className={`relative group ${
                  message.sender_id === user.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-900'
                } rounded-lg px-4 py-2 shadow-sm`}
              >
                {message.reply_to_content && (
                  <div className={`mb-2 pb-2 border-b ${message.sender_id === user.id ? 'border-white/30' : 'border-gray-300'}`}>
                    <p className="text-xs font-semibold opacity-75">
                      Replying to {message.reply_to_sender_name}
                    </p>
                    <p className="text-xs opacity-75 truncate">
                      {message.reply_to_type === 'image' ? '📷 Image' :
                       message.reply_to_type === 'document' ? '📄 Document' :
                       message.reply_to_type === 'voice' ? '🎤 Voice message' :
                       message.reply_to_content}
                    </p>
                  </div>
                )}

                {message.message_type === 'image' && message.attachment_url ? (
                  <div className="relative group">
                    <img 
                      src={message.attachment_url.startsWith('http') ? message.attachment_url : `http://localhost:5000${message.attachment_url}`} 
                      alt="Shared image" 
                      className="max-w-xs rounded-lg mb-1 cursor-pointer"
                      onError={(e) => {
                        console.error('Image load error:', message.attachment_url);
                        e.target.style.display = 'none';
                      }}
                      onClick={() => {
                        const url = message.attachment_url.startsWith('http') 
                          ? message.attachment_url 
                          : `http://localhost:5000${message.attachment_url}`;
                        window.open(url, '_blank');
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = message.attachment_url.startsWith('http') 
                          ? message.attachment_url 
                          : `http://localhost:5000${message.attachment_url}`;
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = message.attachment_name || `image_${message.id}.jpg`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast.success('Image downloaded');
                      }}
                      className="absolute top-2 right-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Download image"
                    >
                      <Download className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : message.message_type === 'document' && message.attachment_url ? (
                  <div className="flex items-center space-x-2">
                    <Paperclip className="w-4 h-4" />
                    <a
                      href={message.attachment_url.startsWith('http') ? message.attachment_url : `http://localhost:5000${message.attachment_url}`}
                      download={message.attachment_name}
                      className="underline hover:opacity-80"
                      onClick={(e) => {
                        e.preventDefault();
                        const url = message.attachment_url.startsWith('http') 
                          ? message.attachment_url 
                          : `http://localhost:5000${message.attachment_url}`;
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = message.attachment_name || `document_${message.id}`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast.success('Document downloaded');
                      }}
                    >
                      {message.attachment_name || 'Document'}
                    </a>
                    <Download className="w-4 h-4" />
                  </div>
                ) : message.message_type === 'voice' && message.attachment_url ? (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => playAudio(message.attachment_url)}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30"
                    >
                      {playingAudio === message.attachment_url ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <span className="text-sm">Voice message</span>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}

                {message.reactions && message.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {message.reactions.map((reaction, idx) => {
                      const reactionData = REACTIONS.find(r => r.name === reaction.reaction);
                      return (
                        <span key={idx} className="text-xs bg-white/20 px-2 py-1 rounded-full">
                          {reactionData?.emoji} {reaction.user_name}
                        </span>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs opacity-75 mt-1">{formatTime(message.created_at)}</p>

                <div className={`absolute ${message.sender_id === user.id ? 'left-0' : 'right-0'} top-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-lg rounded-lg p-1 flex items-center space-x-1`}>
                  <button
                    onClick={() => setReplyTo(message)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Reply"
                  >
                    <Reply className="w-4 h-4 text-gray-600" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setReactionMenu(reactionMenu === message.id ? null : message.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="React"
                    >
                      <Smile className="w-4 h-4 text-gray-600" />
                    </button>
                    {reactionMenu === message.id && (
                      <div className="absolute bottom-full left-0 mb-2 flex items-center space-x-1 bg-white rounded-full shadow-lg p-1">
                        {REACTIONS.map((reaction) => {
                          const Icon = reaction.icon;
                          return (
                            <button
                              key={reaction.name}
                              onClick={() => addReaction(message.id, reaction.name)}
                              className="p-1 hover:scale-125 transition-transform"
                              title={reaction.name}
                            >
                              <span className="text-lg">{reaction.emoji}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setReactionMenu(null)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div className="px-4 py-2 bg-gray-100 border-t flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-600">Replying to {replyTo.sender_name}</p>
            <p className="text-xs text-gray-500 truncate">
              {replyTo.content || (replyTo.message_type === 'image' ? '📷 Image' : 'Voice message')}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Recording Indicator */}
      {recording && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-sm text-red-700 font-medium">Recording voice message...</span>
          </div>
          <button
            onClick={stopRecording}
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            Stop & Send
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t bg-white relative">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-full right-0 mb-2 z-50">
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              height={400}
              width={350}
              previewConfig={{ showPreview: false }}
            />
          </div>
        )}

        <div className="flex items-end space-x-2">
          <div className="flex-1 flex items-end space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
              title="Send Image"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect(e, 'image')}
              className="hidden"
            />
            <button
              onClick={() => documentInputRef.current?.click()}
              className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
              title="Send Document"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={documentInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => handleFileSelect(e, 'document')}
              className="hidden"
            />
            <textarea
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping(e.target.value.length > 0);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (newMessage.trim()) {
                    sendMessage(newMessage);
                  }
                }
              }}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none max-h-32"
              rows="1"
            />
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            {recording ? (
              <button
                onClick={stopRecording}
                className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                title="Stop Recording"
              >
                <Mic className="w-5 h-5" />
              </button>
            ) : (
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
                title="Hold to Record"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            onClick={() => sendMessage(newMessage)}
            disabled={!newMessage.trim()}
            className="btn-primary p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}

