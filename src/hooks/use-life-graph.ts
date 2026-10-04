import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { lifeGraphService,type LGTable } from "@/services/life-graph.service";
export function useLGList(table:LGTable,order="created_at"){return useQuery({queryKey:["lg",table,order],queryFn:()=>lifeGraphService.list(table,order)})}
export function useLGMutations(table:LGTable){const qc=useQueryClient();const invalidate=()=>void qc.invalidateQueries({queryKey:["lg",table]});return{create:useMutation({mutationFn:(x:Record<string,unknown>)=>lifeGraphService.create(table,x),onSuccess:invalidate}),update:useMutation({mutationFn:(x:{id:string;patch:Record<string,unknown>})=>lifeGraphService.update(table,x.id,x.patch),onSuccess:invalidate}),remove:useMutation({mutationFn:(id:string)=>lifeGraphService.remove(table,id),onSuccess:invalidate})}}
export function useAdvancedAI(){return useQuery({queryKey:["lg","advanced-ai"],queryFn:lifeGraphService.advancedInsights,staleTime:60_000})}
