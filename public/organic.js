// The checklist is ephemeral. Do not put intake or personal information in storage.
document.querySelectorAll('[data-print]').forEach(button=>button.addEventListener('click',()=>window.print()));
document.querySelectorAll('[data-clear-checklist]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.checklist input').forEach(input=>{input.checked=false;});
}));
// Close an open mobile menu with Escape and return focus to its summary.
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')document.querySelectorAll('.mobile-nav[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus();});
});
