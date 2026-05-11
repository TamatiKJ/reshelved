import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-black text-white mt-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-end">
          <div>
            <Link to="/" className="inline-flex items-center" aria-label="Reshelved home">
              <img src="/reshelved-logo.svg" alt="Reshelved" className="h-7 w-auto" />
            </Link>
            <p className="text-sm text-white/70 mt-4 max-w-xs">
              Promoting literacy in Kenya one book at a time.
            </p>
            <p className="text-sm text-white/65 mt-6">
              © 2026 Reshelved. All rights reserved. Built by Tamati.
            </p>
          </div>

          <div className="flex flex-wrap md:justify-end gap-x-5 gap-y-3 text-sm text-white/75">
            <Link to="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition">Terms of Service</Link>
            <Link to="/cookies" className="hover:text-white transition">Cookie Policy</Link>
            <Link to="/contact" className="hover:text-white transition">Contact</Link>
          </div>
        </div>
        <div className="border-t border-white/20 mt-10" />
      </div>
    </footer>
  );
};

export default Footer;
