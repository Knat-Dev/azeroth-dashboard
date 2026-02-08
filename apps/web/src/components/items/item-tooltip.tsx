"use client";

import { useState } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import type { ItemTooltipData } from "@repo/shared";
import {
  getItemQualityColor,
  ITEM_BONDING,
  ITEM_INVENTORY_TYPE,
  ITEM_STAT_NAMES,
  ARMOR_SUBCLASS_NAMES,
  WEAPON_SUBCLASS_NAMES,
  DAMAGE_TYPE_NAMES,
} from "@/lib/wow-constants";

function formatSellPrice(copper: number) {
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const cop = copper % 100;
  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (cop > 0 || parts.length === 0) parts.push(`${cop}c`);
  return parts.join(" ");
}

export function ItemTooltip({
  item,
  children,
}: {
  item: ItemTooltipData;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "top",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ["bottom", "right", "left"] }),
      shift({ padding: 8 }),
    ],
  });

  const hover = useHover(context, { delay: { open: 100, close: 0 } });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    dismiss,
  ]);

  const qualityColor = getItemQualityColor(item.quality);
  const isWeapon = item.itemClass === 2;
  const isArmor = item.itemClass === 4;

  const slotName = ITEM_INVENTORY_TYPE[item.inventoryType] ?? "";
  let subclassName = "";
  if (isWeapon) subclassName = WEAPON_SUBCLASS_NAMES[item.itemSubclass] ?? "";
  else if (isArmor) subclassName = ARMOR_SUBCLASS_NAMES[item.itemSubclass] ?? "";

  const dps =
    isWeapon && item.speed > 0
      ? ((item.dmgMin + item.dmgMax) / 2 / item.speed).toFixed(1)
      : null;

  const dmgTypeName = item.dmgType > 0 ? DAMAGE_TYPE_NAMES[item.dmgType] : "";

  return (
    <>
      <span ref={refs.setReference} {...getReferenceProps()} className="inline-block">
        {children}
      </span>
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 w-72 rounded-lg border border-[#404040] bg-[#1a1a2e] p-3 shadow-xl"
          >
            {/* Name */}
            <div className="text-sm font-bold" style={{ color: qualityColor }}>
              {item.name}
            </div>

            {/* Item Level */}
            <div className="text-xs text-yellow-400">
              Item Level {item.itemLevel}
            </div>

            {/* Bonding */}
            {item.bonding > 0 && (
              <div className="text-xs text-white">
                {ITEM_BONDING[item.bonding]}
              </div>
            )}

            {/* Slot + type */}
            {(slotName || subclassName) && (
              <div className="flex justify-between text-xs text-white">
                <span>{slotName}</span>
                <span>{subclassName}</span>
              </div>
            )}

            {/* Weapon damage */}
            {isWeapon && item.dmgMax > 0 && (
              <>
                <div className="flex justify-between text-xs text-white">
                  <span>
                    {item.dmgMin.toFixed(0)} - {item.dmgMax.toFixed(0)}{" "}
                    {dmgTypeName ? `${dmgTypeName} ` : ""}Damage
                  </span>
                  <span>Speed {item.speed.toFixed(2)}</span>
                </div>
                {dps && (
                  <div className="text-xs text-white">
                    ({dps} damage per second)
                  </div>
                )}
              </>
            )}

            {/* Armor */}
            {item.armor > 0 && (
              <div className="text-xs text-white">{item.armor} Armor</div>
            )}

            {/* Stats */}
            {item.stats.map((stat, i) => (
              <div key={i} className="text-xs text-white">
                +{stat.value} {ITEM_STAT_NAMES[stat.type] ?? `Stat #${stat.type}`}
              </div>
            ))}

            {/* Durability */}
            {item.maxDurability > 0 && (
              <div className="text-xs text-white">
                Durability {item.maxDurability} / {item.maxDurability}
              </div>
            )}

            {/* Required level */}
            {item.requiredLevel > 1 && (
              <div className="text-xs text-white">
                Requires Level {item.requiredLevel}
              </div>
            )}

            {/* Description / flavor text */}
            {item.description && (
              <div className="mt-1 text-xs italic text-[#ffd100]">
                &quot;{item.description}&quot;
              </div>
            )}

            {/* Sell price */}
            {item.sellPrice > 0 && (
              <div className="mt-1 text-xs text-white">
                Sell Price: {formatSellPrice(item.sellPrice)}
              </div>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
