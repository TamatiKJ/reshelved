import React from 'react';
import { Link } from 'react-router-dom';
import AdminListingCategoriesPanel from '../components/AdminListingCategoriesPanel';

const AdminListingCategories: React.FC = () => (
  <div className="min-h-screen bg-stone-50 px-4 py-8 sm:px-6 lg:py-10">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <Link to="/admin" className="text-sm font-bold text-[#1665CC] hover:text-[#1254a9]">Back to admin dashboard</Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">Listing Categories</h1>
      </div>
      <AdminListingCategoriesPanel />
    </div>
  </div>
);

export default AdminListingCategories;
