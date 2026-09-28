export const activityCommitLimit=2000;

export interface GitActivity {
  commitsScanned:number;
  truncated:boolean;
  changes:Map<string,{commits:number;lastChanged:string}>;
}

/** Parse `git log -z --format=x%ct --name-only`, preserving spaces in file paths. */
export function parseGitActivity(output:string,tracked:ReadonlySet<string>,commitLimit=activityCommitLimit):GitActivity {
  const changes=new Map<string,{commits:number;lastChanged:string}>();
  let timestamp=0,commitsScanned=0;
  for(const token of output.split('\0')){
    const marker=token.match(/^\n?x(\d{9,})$/);
    if(marker){const parsed=Number(marker[1]);timestamp=Number.isSafeInteger(parsed)&&Math.abs(parsed)<=8_640_000_000_000?parsed:0;commitsScanned++;continue;}
    const file=token.startsWith('\n')?token.slice(1):token;
    if(!file||!timestamp||!tracked.has(file))continue;
    const lastChanged=new Date(timestamp*1000).toISOString().slice(0,10);
    const previous=changes.get(file);
    changes.set(file,{commits:(previous?.commits??0)+1,lastChanged:previous&&previous.lastChanged>lastChanged?previous.lastChanged:lastChanged});
  }
  return{changes,commitsScanned,truncated:commitsScanned>=commitLimit};
}
