import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-black text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <Link to="/" className="inline-flex items-center gap-3">
              <img src="/reshelved-logo-white.svg" alt="Reshelved" className="h-9 w-auto" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <span className="text-xl font-bold">Reshelved</span>
            </Link>
            <p className="text-sm text-white/70 mt-3 max-w-md">
              Affordable physical books for readers in Nairobi. Search, sell, swap, or donate books through one trusted platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-white/80">
            <Link to="/" className="hover:text-white transition">Home</Link>
            <Link to="/browse" className="hover:text-white transition">Browse Book</Link>
            <a href="/#how-it-works" className="hover:text-white transition">How it Works</a>
            <Link to="/create" className="hover:text-white transition">List a Book</Link>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-6 text-sm text-white/60">
          © 2026 Reshelved. Built for readers in Kenya.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
