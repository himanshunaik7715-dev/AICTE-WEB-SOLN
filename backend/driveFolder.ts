export interface DriveItem { id: string; name: string; mimeType: string; subfolderPath?: string; [key: string]: unknown; }
export async function fetchDriveFolder(folderId: string, apiKey: string): Promise<DriveItem[]> {
 if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) throw new Error('Invalid Google Drive folder ID.');
 const signal=AbortSignal.timeout(30000); let running=0,total=0;
 const waiting:Array<()=>void>=[];
 async function page(url:URL) {
  if(running>=4) await new Promise<void>(resolve=>waiting.push(resolve));
  running++;
  try {const response=await fetch(url,{signal});if(!response.ok)throw new Error(`Google Drive returned ${response.status}. Check that the folder is accessible.`);return await response.json();}
  finally {running--;waiting.shift()?.();}
 }
 async function walk(id:string,path='',depth=0):Promise<DriveItem[]> {
  if(depth>5)throw new Error('Folder nesting exceeds five levels. Import a more specific folder.');
  const items:DriveItem[]=[];let token:string|undefined;
  do {const url=new URL('https://www.googleapis.com/drive/v3/files');url.search=new URLSearchParams({q:`'${id}' in parents and trashed=false`,fields:'nextPageToken,files(id,name,mimeType,webViewLink,webContentLink,createdTime,modifiedTime,size)',pageSize:'1000',key:apiKey,...(token?{pageToken:token}:{})}).toString();const result=await page(url);items.push(...(result.files||[]));total+=(result.files||[]).length;if(total>10000)throw new Error('Folder contains too many entries. Import a smaller semester folder.');token=result.nextPageToken;}while(token);
  const nested=await Promise.all(items.map(item=>item.mimeType==='application/vnd.google-apps.folder'?walk(item.id,path?`${path}/${item.name}`:item.name,depth+1):Promise.resolve([{...item,subfolderPath:path||'Root'}])));
  return nested.flat();
 }
 return walk(folderId);
}
