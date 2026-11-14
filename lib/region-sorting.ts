export type RegionSort='alphabet'|'population'|'catalog';
export function sortRegions<T extends {title:string;count?:number}>(regions:readonly T[],sort:RegionSort,population:Readonly<Record<string,number>>):T[]{
 return [...regions].sort((a,b)=>{
  if(sort==='catalog')return (b.count??0)-(a.count??0)||a.title.localeCompare(b.title,'ru');
  if(sort==='population'){
   const left=population[a.title],right=population[b.title];
   if(left==null&&right!=null)return 1;
   if(right==null&&left!=null)return -1;
   if(left!=null&&right!=null&&left!==right)return right-left;
  }
  return a.title.localeCompare(b.title,'ru');
 });
}
