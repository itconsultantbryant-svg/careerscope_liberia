import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { 
  Heart, MessageSquare, Send, Image as ImageIcon, 
  Smile, ThumbsUp, X, MoreVertical, Share2,
  ThumbsDown, Smile as SmileIcon, Frown, Angry, Meh
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const REACTIONS = [
  { name: 'like', icon: ThumbsUp, color: 'text-blue-600' },
  { name: 'love', icon: Heart, color: 'text-red-600' },
  { name: 'laugh', icon: SmileIcon, color: 'text-yellow-600' },
  { name: 'wow', icon: Meh, color: 'text-yellow-500' },
  { name: 'sad', icon: Frown, color: 'text-blue-500' },
  { name: 'angry', icon: Angry, color: 'text-red-700' },
];

export default function Community() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({ content: '', images: [], imagePreviews: [] });
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const [reactionMenus, setReactionMenus] = useState({});
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPosts();
    
    if (socket) {
      socket.on('post_created', (newPost) => {
        setPosts(prev => [newPost, ...prev]);
      });

      socket.on('post_like_update', (data) => {
        setPosts(prev => prev.map(post => 
          post.id === data.postId 
            ? { ...post, likes_count: data.likesCount, is_liked: data.isLiked }
            : post
        ));
      });

      socket.on('comment_added', (data) => {
        setPosts(prev => prev.map(post => 
          post.id === data.postId 
            ? { ...post, comments_count: (post.comments_count || 0) + 1 }
            : post
        ));
        fetchPostComments(data.postId);
      });

      return () => {
        socket.off('post_created');
        socket.off('post_like_update');
        socket.off('comment_added');
      };
    }
  }, [socket]);

  const fetchPosts = async () => {
    try {
      const res = await api.get('/posts');
      const postsData = res.data.posts || [];
      
      // Fetch comments for each post
      for (const post of postsData) {
        try {
          const commentsRes = await api.get(`/posts/${post.id}/comments`);
          post.comments = commentsRes.data.comments || [];
        } catch (error) {
          post.comments = [];
        }
      }
      
      setPosts(postsData);
    } catch (error) {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const fetchPostComments = async (postId) => {
    try {
      const res = await api.get(`/posts/${postId}/comments`);
      setPosts(prev => prev.map(post => 
        post.id === postId ? { ...post, comments: res.data.comments || [] } : post
      ));
    } catch (error) {
      console.error('Failed to fetch comments');
    }
  };

  const createPost = async (e) => {
    e.preventDefault();
    if (!newPost.content.trim() && newPost.images.length === 0) return;

    try {
      const formData = new FormData();
      formData.append('content', newPost.content);
      
      // Append all images
      newPost.images.forEach((image) => {
        formData.append('images', image);
      });

      const res = await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (socket) {
        socket.emit('new_post', res.data.post);
      }

      toast.success('Post created!');
      setNewPost({ content: '', images: [], imagePreviews: [] });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchPosts();
    } catch (error) {
      toast.error('Failed to create post');
    }
  };

  const toggleLike = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      if (socket) {
        socket.emit('post_liked', {
          postId,
          likesCount: res.data.liked ? (posts.find(p => p.id === postId)?.likes_count || 0) + 1 : (posts.find(p => p.id === postId)?.likes_count || 0) - 1,
          isLiked: res.data.liked,
        });
      }
      fetchPosts();
    } catch (error) {
      toast.error('Failed to like post');
    }
  };

  const addComment = async (postId, content, parentCommentId = null) => {
    if (!content.trim()) return;
    try {
      await api.post(`/posts/${postId}/comments`, { content, parentCommentId });
      
      if (socket) {
        socket.emit('new_comment', { postId });
      }
      
      toast.success('Comment added!');
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setReplyInputs(prev => ({ ...prev, [`${postId}_${parentCommentId}`]: '' }));
      fetchPostComments(postId);
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const toggleCommentLike = async (commentId) => {
    try {
      await api.post(`/posts/comments/${commentId}/like`);
      fetchPosts();
    } catch (error) {
      console.error('Like comment error:', error);
      // Silently fail - the like might already exist
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast.error('Please select valid image files');
      return;
    }

    // Limit to 4 images
    const filesToAdd = imageFiles.slice(0, 4 - newPost.images.length);
    
    const newImages = [...newPost.images, ...filesToAdd];
    const newPreviews = [...newPost.imagePreviews];
    
    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push(e.target.result);
        if (newPreviews.length === newImages.length) {
          setNewPost({ ...newPost, images: newImages, imagePreviews: newPreviews });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const postDate = new Date(date);
    const diffInSeconds = Math.floor((now - postDate) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return postDate.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Community Feed</h1>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>

        {/* Create Post */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-8"
        >
          <form onSubmit={createPost}>
            <div className="flex items-start space-x-3 mb-4">
              <div className="w-10 h-10 bg-primary-200 rounded-full flex items-center justify-center flex-shrink-0">
                {user?.profile_image ? (
                  <img 
                    src={user.profile_image.startsWith('http') ? user.profile_image : `http://localhost:5000${user.profile_image}`} 
                    alt={user.first_name} 
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextElementSibling) {
                        e.target.nextElementSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                {!user?.profile_image && (
                  <span className="text-primary-600 font-semibold">
                    {user?.first_name?.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  placeholder={`What's on your mind, ${user?.first_name}?`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                  rows="3"
                />
                {newPost.imagePreviews.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {newPost.imagePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-48 object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = [...newPost.images];
                            const newPreviews = [...newPost.imagePreviews];
                            newImages.splice(index, 1);
                            newPreviews.splice(index, 1);
                            setNewPost({ ...newPost, images: newImages, imagePreviews: newPreviews });
                          }}
                          className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-70"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 text-gray-600 cursor-pointer hover:text-primary-600 transition-colors">
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">Photo</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              </div>
              <button 
                type="submit" 
                className="btn-primary flex items-center space-x-2"
                disabled={!newPost.content.trim() && newPost.images.length === 0}
              >
                <Send className="w-4 h-4" />
                <span>Post</span>
              </button>
            </div>
          </form>
        </motion.div>

        {/* Posts */}
        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className="card text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No posts yet. Be the first to share!</p>
            </div>
          ) : (
            posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
              >
                {/* Post Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 bg-primary-200 rounded-full flex items-center justify-center flex-shrink-0">
                      {post.author_image ? (
                        <img src={post.author_image} alt={post.author_name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <span className="text-primary-600 font-semibold text-lg">
                          {post.author_name?.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{post.author_name}</p>
                      {post.school_name && (
                        <p className="text-sm text-gray-600">{post.school_name}</p>
                      )}
                      <p className="text-xs text-gray-500">{formatTimeAgo(post.created_at)}</p>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>

                {/* Post Content */}
                <p className="mb-4 text-gray-800 whitespace-pre-wrap">{post.content}</p>

                {post.images && post.images.length > 0 ? (
                  <div className={`grid gap-2 mb-4 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                    {post.images.map((imageUrl, index) => {
                      const fullUrl = imageUrl.startsWith('http') ? imageUrl : `http://localhost:5000${imageUrl}`;
                      return (
                        <img
                          key={index}
                          src={fullUrl}
                          alt={`Post image ${index + 1}`}
                          className={`w-full rounded-lg object-cover ${post.images.length === 1 ? 'max-h-96' : 'h-64'}`}
                          onError={(e) => {
                            console.error('Image load error:', imageUrl);
                            e.target.style.display = 'none';
                          }}
                        />
                      );
                    })}
                  </div>
                ) : post.image_url ? (
                  <img
                    src={post.image_url.startsWith('http') ? post.image_url : `http://localhost:5000${post.image_url}`}
                    alt="Post"
                    className="w-full rounded-lg mb-4 max-h-96 object-cover"
                    onError={(e) => {
                      console.error('Image load error:', post.image_url);
                      e.target.style.display = 'none';
                    }}
                  />
                ) : null}

                {/* Post Stats */}
                <div className="flex items-center justify-between py-3 border-t border-b text-sm text-gray-600">
                  <div className="flex items-center space-x-4">
                    {post.likes_count > 0 && (
                      <div className="flex items-center space-x-1">
                        <ThumbsUp className="w-4 h-4 text-blue-600" />
                        <span>{post.likes_count}</span>
                      </div>
                    )}
                    {post.comments_count > 0 && (
                      <span>{post.comments_count} comments</span>
                    )}
                  </div>
                </div>

                {/* Post Actions */}
                <div className="flex items-center justify-around py-2 border-b">
                  <div 
                    className="relative"
                    onMouseEnter={() => setReactionMenus(prev => ({ ...prev, [post.id]: true }))}
                    onMouseLeave={() => setReactionMenus(prev => ({ ...prev, [post.id]: false }))}
                  >
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors ${
                        post.is_liked ? 'text-blue-600' : 'text-gray-600'
                      }`}
                    >
                      <ThumbsUp className={`w-5 h-5 ${post.is_liked ? 'fill-current' : ''}`} />
                      <span className="font-medium">Like</span>
                    </button>
                    <AnimatePresence>
                      {reactionMenus[post.id] && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full left-0 mb-2 flex items-center space-x-1 bg-white rounded-full shadow-lg p-1 z-10"
                          onMouseEnter={() => setReactionMenus(prev => ({ ...prev, [post.id]: true }))}
                          onMouseLeave={() => setReactionMenus(prev => ({ ...prev, [post.id]: false }))}
                        >
                          {REACTIONS.map((reaction) => {
                            const Icon = reaction.icon;
                            return (
                              <button
                                key={reaction.name}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLike(post.id);
                                  setReactionMenus(prev => ({ ...prev, [post.id]: false }));
                                }}
                                className="p-1 hover:scale-125 transition-transform"
                                title={reaction.name}
                              >
                                <Icon className={`w-6 h-6 ${reaction.color}`} />
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-medium">Comment</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                    <Share2 className="w-5 h-5" />
                    <span className="font-medium">Share</span>
                  </button>
                </div>

                {/* Comments Section */}
                <AnimatePresence>
                  {expandedComments[post.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-4 space-y-3"
                    >
                      {/* Existing Comments */}
                      {post.comments && post.comments.length > 0 && (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {post.comments.map((comment) => (
                            <div key={comment.id} className="flex items-start space-x-2">
                              <div className="w-8 h-8 bg-primary-200 rounded-full flex items-center justify-center flex-shrink-0">
                                {comment.author_image ? (
                                  <img src={comment.author_image} alt={comment.author_name} className="w-8 h-8 rounded-full" />
                                ) : (
                                  <span className="text-primary-600 text-xs font-semibold">
                                    {comment.author_name?.charAt(0)}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="bg-gray-100 rounded-lg px-3 py-2">
                                  <p className="font-semibold text-sm">{comment.author_name}</p>
                                  <p className="text-sm text-gray-800">{comment.content}</p>
                                </div>
                                <div className="flex items-center space-x-4 mt-1 ml-2">
                                  <button
                                    onClick={() => toggleCommentLike(comment.id)}
                                    className={`text-xs ${comment.is_liked ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}
                                  >
                                    Like
                                  </button>
                                  <button
                                    onClick={() => setReplyInputs(prev => ({ ...prev, [`${post.id}_${comment.id}`]: !prev[`${post.id}_${comment.id}`] }))}
                                    className="text-xs text-gray-600"
                                  >
                                    Reply
                                  </button>
                                  {comment.likes_count > 0 && (
                                    <span className="text-xs text-gray-500">{comment.likes_count} likes</span>
                                  )}
                                  <span className="text-xs text-gray-500">{formatTimeAgo(comment.created_at)}</span>
                                </div>
                                
                                {/* Replies */}
                                {comment.replies && comment.replies.length > 0 && (
                                  <div className="ml-4 mt-2 space-y-2">
                                    {comment.replies.map((reply) => (
                                      <div key={reply.id} className="flex items-start space-x-2">
                                        <div className="w-6 h-6 bg-primary-200 rounded-full flex items-center justify-center flex-shrink-0">
                                          {reply.author_image ? (
                                            <img src={reply.author_image} alt={reply.author_name} className="w-6 h-6 rounded-full" />
                                          ) : (
                                            <span className="text-primary-600 text-xs font-semibold">
                                              {reply.author_name?.charAt(0)}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex-1">
                                          <div className="bg-gray-50 rounded-lg px-3 py-2">
                                            <p className="font-semibold text-xs">{reply.author_name}</p>
                                            <p className="text-xs text-gray-800">{reply.content}</p>
                                          </div>
                                          <div className="flex items-center space-x-3 mt-1 ml-2">
                                            <button
                                              onClick={() => toggleCommentLike(reply.id)}
                                              className={`text-xs ${reply.is_liked ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}
                                            >
                                              Like
                                            </button>
                                            {reply.likes_count > 0 && (
                                              <span className="text-xs text-gray-500">{reply.likes_count} likes</span>
                                            )}
                                            <span className="text-xs text-gray-500">{formatTimeAgo(reply.created_at)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Reply Input */}
                                <AnimatePresence>
                                  {replyInputs[`${post.id}_${comment.id}`] && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="mt-2 flex items-center space-x-2"
                                    >
                                      <input
                                        type="text"
                                        placeholder="Write a reply..."
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter' && e.target.value.trim()) {
                                            addComment(post.id, e.target.value, comment.id);
                                          }
                                        }}
                                      />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment Input */}
                      <div className="flex items-center space-x-2 pt-2 border-t">
                        <div className="w-8 h-8 bg-primary-200 rounded-full flex items-center justify-center flex-shrink-0">
                          {user?.profile_image ? (
                            <img 
                              src={user.profile_image.startsWith('http') ? user.profile_image : `http://localhost:5000${user.profile_image}`} 
                              alt={user.first_name} 
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextElementSibling) {
                                  e.target.nextElementSibling.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          {!user?.profile_image && (
                            <span className="text-primary-600 text-xs font-semibold">
                              {user?.first_name?.charAt(0)}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Write a comment..."
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              addComment(post.id, e.target.value);
                            }
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
