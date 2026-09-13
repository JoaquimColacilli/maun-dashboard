import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

Object.assign(HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  },
  close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  },
});

if (!('setPointerCapture' in Element.prototype)) {
  Object.assign(Element.prototype, {
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
    hasPointerCapture: () => false,
  });
}

afterEach(() => {
  cleanup();
});
