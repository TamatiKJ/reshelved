import React from 'react';
import ListingImageCropModal, { type CropValues } from '../listing-form/ListingImageCropModal';

type DragState = { startX: number; startY: number; cropX: number; cropY: number } | null;

type Props = {
  crop: CropValues;
  dragState: DragState;
  saving?: boolean;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDragMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onZoomChange: (zoom: number) => void;
  onReset: () => void;
  onCancel: () => void;
  onUsePhoto: () => void;
};

const ProfilePhotoCropModal: React.FC<Props> = ({ crop, dragState, saving = false, onDragStart, onDragMove, onDragEnd, onZoomChange, onReset, onCancel, onUsePhoto }) => {
  return (
    <ListingImageCropModal
      crop={crop}
      dragState={dragState}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onZoomChange={onZoomChange}
      onReset={onReset}
      onSkip={saving ? () => undefined : onCancel}
      onUsePhoto={saving ? () => undefined : onUsePhoto}
    />
  );
};

export default ProfilePhotoCropModal;
