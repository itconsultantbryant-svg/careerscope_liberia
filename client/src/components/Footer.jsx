import { Facebook, MessageCircle, Mail, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src="/assets/careerscope_logo.jpeg" 
                alt="CareerScope Logo" 
                className="h-10 w-auto object-contain"
                style={{ display: 'block', maxHeight: '40px' }}
                onError={(e) => {
                  console.error('Failed to load logo image');
                  e.target.style.display = 'none';
                }}
              />
              <h3 className="text-xl font-bold">CareerScope</h3>
            </div>
            <p className="text-gray-400">
              Empowering Liberian youth with career guidance, mentorship, and opportunities.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xl font-bold mb-4">Contact Us</h3>
            <div className="space-y-2 text-gray-400">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5" />
                <span>Monrovia, Liberia</span>
              </div>
              <div className="flex items-center space-x-2">
                <MessageCircle className="w-5 h-5" />
                <span>WhatsApp: +231 77 000 0000</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5" />
                <span>info@careerscope.lib</span>
              </div>
            </div>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-xl font-bold mb-4">Follow Us</h3>
            <div className="flex space-x-4">
              <a
                href="#"
                className="bg-gray-800 hover:bg-gray-700 p-3 rounded-full transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="bg-gray-800 hover:bg-gray-700 p-3 rounded-full transition-colors"
                aria-label="WhatsApp Group"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; 2025 CareerScope. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

