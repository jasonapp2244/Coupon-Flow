import {
  Baby, BadgePercent, Car, Dumbbell, Gamepad2, Gem, Gift, HeartPulse, Home, Laptop, Lightbulb, PawPrint, Plane, Shirt,
  ShoppingBasket, ShoppingCart, Sparkles, Store, Tag, Utensils, type LucideIcon,
} from 'lucide-react';

/** Keyword → icon. Categories are named by the admin, so this matches words in the name or slug. */
const ICONS: [RegExp, LucideIcon][] = [
  [/fashion|cloth|apparel|shoe|wear/, Shirt],
  [/tech|electr|computer|phone|gadget/, Laptop],
  [/travel|flight|hotel|trip/, Plane],
  [/food|restaurant|dining|meal|deliver/, Utensils],
  [/grocer|supermarket/, ShoppingBasket],
  [/beauty|cosmetic|makeup|skin/, Sparkles],
  [/health|pharma|wellness|medical/, HeartPulse],
  [/home|garden|furniture|decor|kitchen/, Home],
  [/sport|fitness|gym|outdoor/, Dumbbell],
  [/game|gaming|toy/, Gamepad2],
  [/jewel|watch|accessor/, Gem],
  [/pet/, PawPrint],
  [/baby|kid|child/, Baby],
  [/auto|car|motor/, Car],
  [/gift|flower/, Gift],
  [/deal|sale|offer|discount|coupon/, BadgePercent],
  [/tip|guide|how/, Lightbulb],
  [/e-?commerce|marketplace|online/, ShoppingCart],
  [/retail|store|shop/, Store],
];

export function categoryIcon(name: string, slug = ''): LucideIcon {
  const text = `${name} ${slug}`.toLowerCase();
  return ICONS.find(([re]) => re.test(text))?.[1] ?? Tag;
}
