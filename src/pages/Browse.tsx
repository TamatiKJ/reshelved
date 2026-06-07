import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import BookCard from "../components/BookCard";
import type { Listing } from "../types";
import { CONDITIONS } from "../types";
import LocationCombobox from "../components/LocationCombobox";
import { parseListingSnapshot } from "../services/listingValidation";
import { safeLower } from "../utils/stringGuards";
import { useListingCategories } from "../hooks/useListingCategories";

const PAGE_SIZE = 12;
const focusFieldClass =
  "focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10 outline-none";
const selectClass = `w-full pl-3 pr-10 py-2.5 rounded-lg border border-stone-200 text-sm bg-white ${focusFieldClass}`;
const filterLabelClass =
  "mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-stone-500";

const Browse: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const { categories: listingCategories } = useListingCategories();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchScope, setSearchScope] = useState<"all" | "book">("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterCondition, setFilterCondition] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchListings();
  }, []);

  useEffect(() => {
    const categoryFromUrl = searchParams.get("category");
    const searchFromUrl = searchParams.get("search");
    const scopeFromUrl = searchParams.get("scope");

    if (categoryFromUrl) {
      const categoryMatch = listingCategories.find(
        (item) =>
          item.name === categoryFromUrl ||
          item.slug === categoryFromUrl ||
          item.id === categoryFromUrl,
      );
      if (categoryMatch) {
        setFilterCategory(categoryMatch.name);
        setShowFilters(true);
      }
    }

    if (searchFromUrl) {
      setSearch(searchFromUrl);
      setSearchScope(scopeFromUrl === "book" ? "book" : "all");
    }
  }, [searchParams, listingCategories]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType, filterCategory, filterLocation, filterCondition]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "listings"));
      const items = parseListingSnapshot(snap).sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
      );
      setListings(items);
    } catch (err) {
      console.error("Error fetching listings:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = listings.filter((l) => {
    const now = Date.now();
    if (!l.active || l.expiresAt < now) return false;
    if (filterType !== "all" && l.type !== filterType) return false;
    if (
      filterCategory !== "all" &&
      (l.categoryName || l.category) !== filterCategory &&
      l.categoryId !== filterCategory
    )
      return false;
    if (filterLocation !== "all" && l.location !== filterLocation) return false;
    if (filterCondition !== "all" && l.condition !== filterCondition)
      return false;
    if (search.trim()) {
      const s = safeLower(search);
      const title = safeLower(l.title);
      const author = safeLower(l.author);

      if (searchScope === "book")
        return title.includes(s) || author.includes(s);

      return (
        title.includes(s) ||
        author.includes(s) ||
        safeLower(l.description).includes(s) ||
        safeLower(l.categoryName || l.category).includes(s) ||
        safeLower(l.condition).includes(s) ||
        safeLower(l.location).includes(s) ||
        safeLower(l.type).includes(s)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedListings = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(nextPage);
    requestAnimationFrame(() =>
      document
        .getElementById("browse-results")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const clearFilters = () => {
    setSearch("");
    setSearchScope("all");
    setFilterType("all");
    setFilterCategory("all");
    setFilterLocation("all");
    setFilterCondition("all");
  };

  const filterPanel = (
    <aside
      className={`${showFilters ? "block" : "hidden"} lg:block lg:sticky lg:top-24 lg:self-start rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h5 className="text-stone-950">Filters</h5>
          <p className="mt-1 text-sm text-stone-500">Refine your results.</p>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="cursor-pointer text-sm font-bold text-[#1665CC] hover:underline"
        >
          Clear
        </button>
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <span className={filterLabelClass}>Listing type</span>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {[
              { key: "all", label: "All Books", icon: "las la-book" },
              { key: "swap", label: "Swap", icon: "las la-sync" },
              { key: "donate", label: "Donate", icon: "las la-gift" },
              { key: "sell", label: "Sell", icon: "las la-tag" },
            ].map((item) => {
              const active = filterType === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilterType(item.key)}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition ${active ? "border-[#1665CC] bg-[#1665CC]/10 text-[#1665CC]" : "border-stone-200 bg-white text-stone-700 hover:border-[#1665CC] hover:bg-[#1665CC]/5"}`}
                >
                  <i className={`${item.icon} text-lg`} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={filterLabelClass}>Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={selectClass}
          >
            <option value="all">All Categories</option>
            {listingCategories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={filterLabelClass}>Location</label>
          <LocationCombobox
            value={filterLocation}
            onChange={setFilterLocation}
            includeAllOption
            allOptionLabel="All Locations"
            allOptionValue="all"
            className={`${selectClass} pr-11`}
            placeholder="Search location"
          />
        </div>

        <div>
          <label className={filterLabelClass}>Condition</label>
          <select
            value={filterCondition}
            onChange={(e) => setFilterCondition(e.target.value)}
            className={selectClass}
          >
            <option value="all">All Conditions</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#F7F7F5] pb-10 sm:pb-20">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <nav
            className="mb-5 flex items-center gap-2 text-sm text-stone-500"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="font-semibold hover:text-primary-700">
              Home
            </Link>
            <span className="text-stone-300">/</span>
            <span className="font-semibold text-stone-900">Browse</span>
          </nav>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full lg:w-2/3">
              <h1 className="w-full text-3xl font-bold text-stone-950 sm:text-5xl">
                Find free & affordable books near you
              </h1>
              <p className="mt-4 text-lg text-stone-600">
                Search by title, author, genre, condition, and location.
              </p>
            </div>
            {currentUser ? (
              <Link
                to="/create"
                className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white transition hover:bg-primary-700"
              >
                List a Book
              </Link>
            ) : (
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white transition hover:bg-primary-700"
              >
                Join Reshelved
              </Link>
            )}
          </div>
        </div>
      </section>

      <section
        id="browse-results"
        className="mx-auto max-w-7xl scroll-mt-24 px-4 py-8 sm:px-6"
      >
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          {filterPanel}

          <div className="min-w-0">
            <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <i className="las la-search absolute left-3 top-1/2 -translate-y-1/2 text-xl text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search title, author, genre, field, condition, or location..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSearchScope("all");
                    }}
                    className={`w-full rounded-xl border border-stone-200 py-3 pl-10 pr-4 text-sm transition ${focusFieldClass}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters((current) => !current)}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-[#1665CC] hover:bg-[#1665CC]/5 hover:text-[#1665CC] lg:hidden"
                >
                  <i className="las la-sliders-h text-lg" /> Filters
                </button>
              </div>
            </div>

            <p className="body-text mb-6 font-bold text-stone-900">
              {filtered.length} {filtered.length === 1 ? "Book" : "Books"}{" "}
              Available
            </p>
            {loading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse overflow-hidden rounded-2xl border border-stone-200 bg-white"
                  >
                    <div className="aspect-[4/3] bg-stone-200" />
                    <div className="space-y-3 p-4">
                      <div className="h-4 w-3/4 rounded bg-stone-200" />
                      <div className="h-3 w-1/2 rounded bg-stone-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-stone-200 bg-white py-16 text-center">
                <i className="las la-book-open text-6xl text-stone-300" />
                <h3 className="mt-3 text-lg font-bold text-stone-800">
                  No books found
                </h3>
                <p className="mt-1 text-stone-500">
                  Try adjusting your filters or search terms.
                </p>
                {currentUser && (
                  <Link
                    to="/create"
                    className="mt-4 inline-block rounded-xl bg-primary-600 px-5 py-2.5 font-semibold text-white transition hover:bg-primary-700"
                  >
                    List the first book
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {paginatedListings.map((listing) => (
                    <BookCard key={listing.id} listing={listing} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => goToPage(safePage - 1)}
                      disabled={safePage === 1}
                      className="cursor-pointer rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          onClick={() => goToPage(page)}
                          className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition ${page === safePage ? "border-primary-600 bg-primary-600 text-white" : "border-stone-200 text-stone-700 hover:bg-stone-50"}`}
                        >
                          {page}
                        </button>
                      ),
                    )}
                    <button
                      onClick={() => goToPage(safePage + 1)}
                      disabled={safePage === totalPages}
                      className="cursor-pointer rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Browse;
