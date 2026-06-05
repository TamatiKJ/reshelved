import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ListingGallery from '../components/ListingGallery';
import RatingModal from '../components/RatingModal';
import RatingStars from '../components/RatingStars';
import RecentListings from '../components/