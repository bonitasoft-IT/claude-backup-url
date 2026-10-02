export function attachDropzone(zone, input, onFiles) {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    onFiles([...e.dataTransfer.files]);
  });
  zone.addEventListener('click', (e) => {
    if (e.target !== input) input.click();
  });
  input.addEventListener('change', () => {
    onFiles([...input.files]);
    input.value = '';
  });
}

export function installWindowDropGuard() {
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}
