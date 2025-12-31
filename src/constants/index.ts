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
  gray: { color: '#6b7280', bg: 'bg-gray-50', text: 'text-gray-600', accent: 'text-gray-600', badge: 'bg-gray-100 text-gray-600 border-gray-200', border: 'border-gray-300', ring: 'focus-within:ring-gray-200', buttonRing: 'focus:ring-gray-200 focus:border-gray-300', dot: 'bg-gray-400', breadcrumb: 'bg-gray-50 text-gray-600 hover:bg-gray-100', indicator: 'bg-gray-500', ringColor: 'ring-gray-400' },
  blue: { color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-600', accent: 'text-blue-600', badge: 'bg-blue-100 text-blue-600 border-blue-200', border: 'border-blue-500', ring: 'focus-within:ring-blue-200', buttonRing: 'focus:ring-blue-200 focus:border-blue-300', dot: 'bg-blue-400', breadcrumb: 'bg-blue-50 text-blue-600 hover:bg-blue-100', indicator: 'bg-blue-500', ringColor: 'ring-blue-400' },
  indigo: { color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-600', accent: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-600 border-indigo-200', border: 'border-indigo-500', ring: 'focus-within:ring-indigo-200', buttonRing: 'focus:ring-indigo-200 focus:border-indigo-300', dot: 'bg-indigo-400', breadcrumb: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100', indicator: 'bg-indigo-500', ringColor: 'ring-indigo-400' },
  red: { color: '#ef4444', bg: 'bg-red-50', text: 'text-red-600', accent: 'text-red-600', badge: 'bg-red-100 text-red-600 border-red-200', border: 'border-red-500', ring: 'focus-within:ring-red-200', buttonRing: 'focus:ring-red-200 focus:border-red-300', dot: 'bg-red-400', breadcrumb: 'bg-red-50 text-red-600 hover:bg-red-100', indicator: 'bg-red-500', ringColor: 'ring-red-400' },
  orange: { color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-600', accent: 'text-orange-600', badge: 'bg-orange-100 text-orange-600 border-orange-200', border: 'border-orange-500', ring: 'focus-within:ring-orange-200', buttonRing: 'focus:ring-orange-200 focus:border-orange-300', dot: 'bg-orange-400', breadcrumb: 'bg-orange-50 text-orange-600 hover:bg-orange-100', indicator: 'bg-orange-500', ringColor: 'ring-orange-400' },
  amber: { color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-600', accent: 'text-amber-600', badge: 'bg-amber-100 text-amber-600 border-amber-200', border: 'border-amber-500', ring: 'focus-within:ring-amber-200', buttonRing: 'focus:ring-amber-200 focus:border-amber-300', dot: 'bg-amber-400', breadcrumb: 'bg-amber-50 text-amber-600 hover:bg-amber-100', indicator: 'bg-amber-500', ringColor: 'ring-amber-400' },
  green: { color: '#10b981', bg: 'bg-green-50', text: 'text-green-600', accent: 'text-green-600', badge: 'bg-green-100 text-green-600 border-green-200', border: 'border-green-500', ring: 'focus-within:ring-green-200', buttonRing: 'focus:ring-green-200 focus:border-green-300', dot: 'bg-green-400', breadcrumb: 'bg-green-50 text-green-600 hover:bg-green-100', indicator: 'bg-green-500', ringColor: 'ring-green-400' },
  teal: { color: '#14b8a6', bg: 'bg-teal-50', text: 'text-teal-600', accent: 'text-teal-600', badge: 'bg-teal-100 text-teal-600 border-teal-200', border: 'border-teal-500', ring: 'focus-within:ring-teal-200', buttonRing: 'focus:ring-teal-200 focus:border-teal-300', dot: 'bg-teal-400', breadcrumb: 'bg-teal-50 text-teal-600 hover:bg-teal-100', indicator: 'bg-teal-500', ringColor: 'ring-teal-400' },
  cyan: { color: '#06b6d4', bg: 'bg-cyan-50', text: 'text-cyan-600', accent: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-600 border-cyan-200', border: 'border-cyan-500', ring: 'focus-within:ring-cyan-200', buttonRing: 'focus:ring-cyan-200 focus:border-cyan-300', dot: 'bg-cyan-400', breadcrumb: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100', indicator: 'bg-cyan-500', ringColor: 'ring-cyan-400' },
  sky: { color: '#0ea5e9', bg: 'bg-sky-50', text: 'text-sky-600', accent: 'text-sky-600', badge: 'bg-sky-100 text-sky-600 border-sky-200', border: 'border-sky-500', ring: 'focus-within:ring-sky-200', buttonRing: 'focus:ring-sky-200 focus:border-sky-300', dot: 'bg-sky-400', breadcrumb: 'bg-sky-50 text-sky-600 hover:bg-sky-100', indicator: 'bg-sky-500', ringColor: 'ring-sky-400' },
  purple: { color: '#a855f7', bg: 'bg-purple-50', text: 'text-purple-600', accent: 'text-purple-600', badge: 'bg-purple-100 text-purple-600 border-purple-200', border: 'border-purple-500', ring: 'focus-within:ring-purple-200', buttonRing: 'focus:ring-purple-200 focus:border-purple-300', dot: 'bg-purple-400', breadcrumb: 'bg-purple-50 text-purple-600 hover:bg-purple-100', indicator: 'bg-purple-500', ringColor: 'ring-purple-400' },
  fuchsia: { color: '#d946ef', bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', accent: 'text-fuchsia-600', badge: 'bg-fuchsia-100 text-fuchsia-600 border-fuchsia-200', border: 'border-fuchsia-500', ring: 'focus-within:ring-fuchsia-200', buttonRing: 'focus:ring-fuchsia-200 focus:border-fuchsia-300', dot: 'bg-fuchsia-400', breadcrumb: 'bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100', indicator: 'bg-fuchsia-500', ringColor: 'ring-fuchsia-400' },
  pink: { color: '#ec4899', bg: 'bg-pink-50', text: 'text-pink-600', accent: 'text-pink-600', badge: 'bg-pink-100 text-pink-600 border-pink-200', border: 'border-pink-500', ring: 'focus-within:ring-pink-200', buttonRing: 'focus:ring-pink-200 focus:border-pink-300', dot: 'bg-pink-400', breadcrumb: 'bg-pink-50 text-pink-600 hover:bg-pink-100', indicator: 'bg-pink-500', ringColor: 'ring-pink-400' },
  rose: { color: '#f43f5e', bg: 'bg-rose-50', text: 'text-rose-600', accent: 'text-rose-600', badge: 'bg-rose-100 text-rose-600 border-rose-200', border: 'border-rose-500', ring: 'focus-within:ring-rose-200', buttonRing: 'focus:ring-rose-200 focus:border-rose-300', dot: 'bg-rose-400', breadcrumb: 'bg-rose-50 text-rose-600 hover:bg-rose-100', indicator: 'bg-rose-500', ringColor: 'ring-rose-400' },
};
