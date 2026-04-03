document.querySelectorAll('time[datetime] .local-time').forEach(function (span) {
  var timeEl = span.closest('time[datetime]');
  if (!timeEl) return;
  var dt = timeEl.getAttribute('datetime');
  if (!dt) return;
  try {
    span.textContent = new Intl.DateTimeFormat('default', {
      hour: 'numeric',
      minute: 'numeric',
      timeZoneName: 'long'
    }).format(new Date(dt));
  } catch (e) {}
});
