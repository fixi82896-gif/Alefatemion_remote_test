'use strict';

function currentAlbumVideoContext() {
  if (state.tab !== 'albums' || typeof atAlbumsRoot !== 'function' || atAlbumsRoot()) return false;
  const currentName = normalizeSearch(state.folderStack?.[state.folderStack.length - 1]?.name || '');
  const namedVideo = ['ویدیو','ویدئو','فیلم','کلیپ','video'].some((word) => currentName.includes(normalizeSearch(word)));
  const media = (state.folderItems || []).filter((x) => x.isImage || x.isVideo);
  const onlyVideos = media.length > 0 && media.every((x) => x.isVideo);
  return namedVideo || onlyVideos;
}

const parityBaseCloseDrawerDirect = closeDrawerDirect;
closeDrawerDirect = function closeDrawerDirectParity() {
  const consumeSyntheticState = history.state?.alef && history.state?.kind === 'drawer' && !state.restoringHistory;
  parityBaseCloseDrawerDirect();
  if (consumeSyntheticState) history.replaceState(navSnapshot('tab'), '', location.pathname + location.search);
};

const parityBaseCloseModalDirect = closeModalDirect;
closeModalDirect = function closeModalDirectParity() {
  const consumeSyntheticState = history.state?.alef && history.state?.kind === 'modal' && !state.restoringHistory;
  parityBaseCloseModalDirect();
  if (consumeSyntheticState) history.replaceState(navSnapshot('tab'), '', location.pathname + location.search);
  queueMicrotask(() => {
    if (state.tab === 'albums') setRadioVideoGate(currentAlbumVideoContext());
    else updateRadioVideoGate();
  });
};

const parityBaseRenderAlbums = renderAlbums;
renderAlbums = async function renderAlbumsParity() {
  await parityBaseRenderAlbums();
  if (state.tab === 'albums') setRadioVideoGate(currentAlbumVideoContext());
};

const parityBaseRenderViewer = renderViewer;
renderViewer = function renderViewerParity() {
  parityBaseRenderViewer();
  const item = viewerCurrent();
  const viewerVideo = Boolean(item && (item.isVideo || String(item.type || '').startsWith('video/')));
  setRadioVideoGate(currentAlbumVideoContext() || viewerVideo);
};

async function parityLoadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source:bitmap, width:bitmap.width, height:bitmap.height, cleanup:() => bitmap.close?.() };
    } catch { /* Safari fallback below */ }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('تصویر انتخاب‌شده قابل خواندن نیست.'));
      image.src = objectUrl;
    });
    return { source:image, width:image.naturalWidth, height:image.naturalHeight, cleanup:() => URL.revokeObjectURL(objectUrl) };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

compressProfilePhotoFile = async function compressProfilePhotoFileParity(file) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('فایل انتخاب‌شده تصویر معتبر نیست.');
  const loaded = await parityLoadImage(file);
  try {
    const max = 640;
    const scale = Math.min(1, max / Math.max(loaded.width, loaded.height));
    const width = Math.max(1, Math.round(loaded.width * scale));
    const height = Math.max(1, Math.round(loaded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha:false });
    if (!context) throw new Error('آماده‌سازی عکس در این مرورگر ممکن نیست.');
    context.drawImage(loaded.source, 0, 0, width, height);
    let dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    if (dataUrl.length > 220000) dataUrl = canvas.toDataURL('image/jpeg', 0.62);
    return dataUrl;
  } finally {
    loaded.cleanup();
  }
};
