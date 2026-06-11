import { getPreviewFeedUrl } from './cameras';

/**
 * Live MJPEG preview pane inside the detail overlay. Self-contained behind
 * open/close/dispose so a full-quality SDK player can replace the internals
 * later without touching the overlay.
 */
export class VideoPane {
  constructor() {
    this.img = document.getElementById('video-stream');
    this.live = document.getElementById('video-live');
    this.errorEl = document.getElementById('video-error');
    this._openId = 0;
  }

  async open(deviceId) {
    const id = ++this._openId;
    this.errorEl.hidden = true;
    this.live.hidden = true;
    this.img.removeAttribute('src');

    const { url, error } = await getPreviewFeedUrl(deviceId);
    if (id !== this._openId) return; // closed/reopened while fetching
    if (error || !url) {
      this.errorEl.textContent = error || 'No live feed available';
      this.errorEl.hidden = false;
      return;
    }
    // multipartUrl is pre-signed: use verbatim, never append parameters.
    this.img.src = url;
    this.live.hidden = false;
  }

  close() {
    this._openId++;
    // Clearing src terminates the MJPEG connection.
    this.img.removeAttribute('src');
    this.live.hidden = true;
    this.errorEl.hidden = true;
  }

  dispose() {
    this.close();
  }
}
