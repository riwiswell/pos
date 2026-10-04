/** Stable PERSONAL OS domain contracts. */
export type HabitType="check"|"counter"; export type HabitKind="habit"|"activity";
export interface Profile{id:string;full_name:string|null;display_name:string|null;avatar_url:string|null;background_url:string|null;accent_color:string|null;help_enabled:boolean;module_order:string[];hidden_modules:string[];hidden_features:Record<string,boolean>;dashboard_widgets:string[];notification_preferences:Record<string,any>;created_at:string;updated_at:string}
export interface HabitCategory{id:string;user_id:string;name:string;color:string;position:number;created_at:string;updated_at:string}
export interface Habit{id:string;user_id:string;category_id:string|null;name:string;type:HabitType;kind:HabitKind;target:number|null;unit:string|null;position:number;active:boolean;created_at:string;updated_at:string}
export interface HabitLog{id:string;user_id:string;habit_id:string;date:string;completed:boolean;value:number;note:string|null;created_at:string;updated_at:string}
export interface HabitCategoryInput{name:string;color:string}
export interface HabitInput{category_id:string|null;name:string;type:HabitType;kind:HabitKind;target:number|null;unit:string|null}