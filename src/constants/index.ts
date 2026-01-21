export const APP_VERSION = "v1.6.0";
export const INDENT_SIZE = 28;

export const DRAG_GHOST_IMG = new Image();
DRAG_GHOST_IMG.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export interface ThemeColor {
  color: string;
  bg: string;
  text: string;
  accent: string;
  badge: string;
  border: string;
  ring: string;
  buttonRing: string;
  dot: string;
  breadcrumb: string;
  indicator: string;
  ringColor: string;
}

export const COLOR_THEMES: Record<string, ThemeColor> = {
  // Grays / Neutrals
  slate: { color: '#64748b', bg: 'bg-slate-50', text: 'text-slate-600', accent: 'text-slate-600', badge: 'bg-slate-100 text-slate-600 border-slate-200', border: 'border-slate-500', ring: 'focus-within:ring-slate-200', buttonRing: 'focus:ring-slate-200 focus:border-slate-300', dot: 'bg-slate-400', breadcrumb: 'bg-slate-50 text-slate-600 hover:bg-slate-100', indicator: 'bg-slate-500', ringColor: 'ring-slate-400' },
  gray: { color: '#6b7280', bg: 'bg-gray-50', text: 'text-gray-600', accent: 'text-gray-600', badge: 'bg-gray-100 text-gray-600 border-gray-200', border: 'border-gray-300', ring: 'focus-within:ring-gray-200', buttonRing: 'focus:ring-gray-200 focus:border-gray-300', dot: 'bg-gray-400', breadcrumb: 'bg-gray-50 text-gray-600 hover:bg-gray-100', indicator: 'bg-gray-500', ringColor: 'ring-gray-400' },
  zinc: { color: '#71717a', bg: 'bg-zinc-50', text: 'text-zinc-600', accent: 'text-zinc-600', badge: 'bg-zinc-100 text-zinc-600 border-zinc-200', border: 'border-zinc-500', ring: 'focus-within:ring-zinc-200', buttonRing: 'focus:ring-zinc-200 focus:border-zinc-300', dot: 'bg-zinc-400', breadcrumb: 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100', indicator: 'bg-zinc-500', ringColor: 'ring-zinc-400' },
  neutral: { color: '#737373', bg: 'bg-neutral-50', text: 'text-neutral-600', accent: 'text-neutral-600', badge: 'bg-neutral-100 text-neutral-600 border-neutral-200', border: 'border-neutral-500', ring: 'focus-within:ring-neutral-200', buttonRing: 'focus:ring-neutral-200 focus:border-neutral-300', dot: 'bg-neutral-400', breadcrumb: 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100', indicator: 'bg-neutral-500', ringColor: 'ring-neutral-400' },
  stone: { color: '#78716c', bg: 'bg-stone-50', text: 'text-stone-600', accent: 'text-stone-600', badge: 'bg-stone-100 text-stone-600 border-stone-200', border: 'border-stone-500', ring: 'focus-within:ring-stone-200', buttonRing: 'focus:ring-stone-200 focus:border-stone-300', dot: 'bg-stone-400', breadcrumb: 'bg-stone-50 text-stone-600 hover:bg-stone-100', indicator: 'bg-stone-500', ringColor: 'ring-stone-400' },

  // Reds / Oranges / Yellows
  red: { color: '#ef4444', bg: 'bg-red-50', text: 'text-red-600', accent: 'text-red-600', badge: 'bg-red-100 text-red-600 border-red-200', border: 'border-red-500', ring: 'focus-within:ring-red-200', buttonRing: 'focus:ring-red-200 focus:border-red-300', dot: 'bg-red-400', breadcrumb: 'bg-red-50 text-red-600 hover:bg-red-100', indicator: 'bg-red-500', ringColor: 'ring-red-400' },
  orange: { color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-600', accent: 'text-orange-600', badge: 'bg-orange-100 text-orange-600 border-orange-200', border: 'border-orange-500', ring: 'focus-within:ring-orange-200', buttonRing: 'focus:ring-orange-200 focus:border-orange-300', dot: 'bg-orange-400', breadcrumb: 'bg-orange-50 text-orange-600 hover:bg-orange-100', indicator: 'bg-orange-500', ringColor: 'ring-orange-400' },
  amber: { color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-600', accent: 'text-amber-600', badge: 'bg-amber-100 text-amber-600 border-amber-200', border: 'border-amber-500', ring: 'focus-within:ring-amber-200', buttonRing: 'focus:ring-amber-200 focus:border-amber-300', dot: 'bg-amber-400', breadcrumb: 'bg-amber-50 text-amber-600 hover:bg-amber-100', indicator: 'bg-amber-500', ringColor: 'ring-amber-400' },
  yellow: { color: '#eab308', bg: 'bg-yellow-50', text: 'text-yellow-600', accent: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-600 border-yellow-200', border: 'border-yellow-500', ring: 'focus-within:ring-yellow-200', buttonRing: 'focus:ring-yellow-200 focus:border-yellow-300', dot: 'bg-yellow-400', breadcrumb: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100', indicator: 'bg-yellow-500', ringColor: 'ring-yellow-400' },

  // Greens
  lime: { color: '#84cc16', bg: 'bg-lime-50', text: 'text-lime-600', accent: 'text-lime-600', badge: 'bg-lime-100 text-lime-600 border-lime-200', border: 'border-lime-500', ring: 'focus-within:ring-lime-200', buttonRing: 'focus:ring-lime-200 focus:border-lime-300', dot: 'bg-lime-400', breadcrumb: 'bg-lime-50 text-lime-600 hover:bg-lime-100', indicator: 'bg-lime-500', ringColor: 'ring-lime-400' },
  green: { color: '#10b981', bg: 'bg-green-50', text: 'text-green-600', accent: 'text-green-600', badge: 'bg-green-100 text-green-600 border-green-200', border: 'border-green-500', ring: 'focus-within:ring-green-200', buttonRing: 'focus:ring-green-200 focus:border-green-300', dot: 'bg-green-400', breadcrumb: 'bg-green-50 text-green-600 hover:bg-green-100', indicator: 'bg-green-500', ringColor: 'ring-green-400' },
  emerald: { color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600', accent: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-600 border-emerald-200', border: 'border-emerald-500', ring: 'focus-within:ring-emerald-200', buttonRing: 'focus:ring-emerald-200 focus:border-emerald-300', dot: 'bg-emerald-400', breadcrumb: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100', indicator: 'bg-emerald-500', ringColor: 'ring-emerald-400' },
  teal: { color: '#14b8a6', bg: 'bg-teal-50', text: 'text-teal-600', accent: 'text-teal-600', badge: 'bg-teal-100 text-teal-600 border-teal-200', border: 'border-teal-500', ring: 'focus-within:ring-teal-200', buttonRing: 'focus:ring-teal-200 focus:border-teal-300', dot: 'bg-teal-400', breadcrumb: 'bg-teal-50 text-teal-600 hover:bg-teal-100', indicator: 'bg-teal-500', ringColor: 'ring-teal-400' },

  // Blues / Cyans
  cyan: { color: '#06b6d4', bg: 'bg-cyan-50', text: 'text-cyan-600', accent: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-600 border-cyan-200', border: 'border-cyan-500', ring: 'focus-within:ring-cyan-200', buttonRing: 'focus:ring-cyan-200 focus:border-cyan-300', dot: 'bg-cyan-400', breadcrumb: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100', indicator: 'bg-cyan-500', ringColor: 'ring-cyan-400' },
  sky: { color: '#0ea5e9', bg: 'bg-sky-50', text: 'text-sky-600', accent: 'text-sky-600', badge: 'bg-sky-100 text-sky-600 border-sky-200', border: 'border-sky-500', ring: 'focus-within:ring-sky-200', buttonRing: 'focus:ring-sky-200 focus:border-sky-300', dot: 'bg-sky-400', breadcrumb: 'bg-sky-50 text-sky-600 hover:bg-sky-100', indicator: 'bg-sky-500', ringColor: 'ring-sky-400' },
  blue: { color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-600', accent: 'text-blue-600', badge: 'bg-blue-100 text-blue-600 border-blue-200', border: 'border-blue-500', ring: 'focus-within:ring-blue-200', buttonRing: 'focus:ring-blue-200 focus:border-blue-300', dot: 'bg-blue-400', breadcrumb: 'bg-blue-50 text-blue-600 hover:bg-blue-100', indicator: 'bg-blue-500', ringColor: 'ring-blue-400' },
  indigo: { color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-600', accent: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-600 border-indigo-200', border: 'border-indigo-500', ring: 'focus-within:ring-indigo-200', buttonRing: 'focus:ring-indigo-200 focus:border-indigo-300', dot: 'bg-indigo-400', breadcrumb: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100', indicator: 'bg-indigo-500', ringColor: 'ring-indigo-400' },

  // Purples / Pinks
  violet: { color: '#8b5cf6', bg: 'bg-violet-50', text: 'text-violet-600', accent: 'text-violet-600', badge: 'bg-violet-100 text-violet-600 border-violet-200', border: 'border-violet-500', ring: 'focus-within:ring-violet-200', buttonRing: 'focus:ring-violet-200 focus:border-violet-300', dot: 'bg-violet-400', breadcrumb: 'bg-violet-50 text-violet-600 hover:bg-violet-100', indicator: 'bg-violet-500', ringColor: 'ring-violet-400' },
  purple: { color: '#a855f7', bg: 'bg-purple-50', text: 'text-purple-600', accent: 'text-purple-600', badge: 'bg-purple-100 text-purple-600 border-purple-200', border: 'border-purple-500', ring: 'focus-within:ring-purple-200', buttonRing: 'focus:ring-purple-200 focus:border-purple-300', dot: 'bg-purple-400', breadcrumb: 'bg-purple-50 text-purple-600 hover:bg-purple-100', indicator: 'bg-purple-500', ringColor: 'ring-purple-400' },
  fuchsia: { color: '#d946ef', bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', accent: 'text-fuchsia-600', badge: 'bg-fuchsia-100 text-fuchsia-600 border-fuchsia-200', border: 'border-fuchsia-500', ring: 'focus-within:ring-fuchsia-200', buttonRing: 'focus:ring-fuchsia-200 focus:border-fuchsia-300', dot: 'bg-fuchsia-400', breadcrumb: 'bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100', indicator: 'bg-fuchsia-500', ringColor: 'ring-fuchsia-400' },
  pink: { color: '#ec4899', bg: 'bg-pink-50', text: 'text-pink-600', accent: 'text-pink-600', badge: 'bg-pink-100 text-pink-600 border-pink-200', border: 'border-pink-500', ring: 'focus-within:ring-pink-200', buttonRing: 'focus:ring-pink-200 focus:border-pink-300', dot: 'bg-pink-400', breadcrumb: 'bg-pink-50 text-pink-600 hover:bg-pink-100', indicator: 'bg-pink-500', ringColor: 'ring-pink-400' },
  rose: { color: '#f43f5e', bg: 'bg-rose-50', text: 'text-rose-600', accent: 'text-rose-600', badge: 'bg-rose-100 text-rose-600 border-rose-200', border: 'border-rose-500', ring: 'focus-within:ring-rose-200', buttonRing: 'focus:ring-rose-200 focus:border-rose-300', dot: 'bg-rose-400', breadcrumb: 'bg-rose-50 text-rose-600 hover:bg-rose-100', indicator: 'bg-rose-500', ringColor: 'ring-rose-400' },
};
