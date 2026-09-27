export function activateOnKeyboard(event:Pick<KeyboardEvent,'key'|'preventDefault'>,activate:()=>void):boolean {
  if(event.key!=='Enter'&&event.key!==' ')return false;
  event.preventDefault();
  activate();
  return true;
}
