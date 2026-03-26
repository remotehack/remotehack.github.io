for (const a of document.querySelectorAll('.🗺 a')) {
  if (location.href === a.href) a.classList.add('current');
}
