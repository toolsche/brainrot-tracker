# bot.py
from operator import index
import os
import json
import asyncio
import requests

from typing import List
from pathlib import Path
from dotenv import load_dotenv

import discord
from discord import app_commands
from discord.ext import commands

env_path = Path(__file__).parent / '.env'

# Lädt die Datei explizit mit absolutem Pfad
load_dotenv(dotenv_path=env_path, override=True)

TOKEN = os.getenv("DISCORD_TOKEN")
if not TOKEN:
    raise SystemExit("Please set DISCORD_TOKEN in environment (e.g. .env)")

DB_FILE = "brainrot_db.json"
OWN_FILE = "ownership.json"
MAX_SUGGEST = 25  # Discord erlaubt bis 25 choices


# helper: safe load/save json
def load_json(path: str, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return default

def save_json(path: str, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# load DB at startup (you can add hot-reload later)
ITEM_DB = load_json(DB_FILE, {})
OWN_DB = load_json(OWN_FILE, {})

# Allowed ownership indexes
OWN_INDEXES = ["Normal", "Gold", "Diamond", "Candy", "Rainbow", "Galaxy", "YinYang", "Radioactive"]

for user_id, items in OWN_DB.items():
    if not isinstance(items, dict):
        OWN_DB[user_id] = {}
        continue
    for item_name, value in list(items.items()):
        if not isinstance(value, list):
            # Alte Daten (String, None, etc.) → in Liste umwandeln oder löschen
            if isinstance(value, str) and value in OWN_INDEXES:
                items[item_name] = [value]   # alten String in Liste packen
            else:
                items[item_name] = []        # alles andere weg

print("cleaned up ownership-db und repariert")

# sort list one time for fast auto complete
ITEM_NAMES = sorted(ITEM_DB.keys(), key=lambda x: x.lower()) if ITEM_DB else []
print(f"Geladen: {len(ITEM_DB)} Items, {len(OWN_DB)} Besitzer")

def format_number(num) -> str:
    if not num or not isinstance(num, (int, float)):
        return "—"
    
    num = float(num)
    
    if num >= 1_000_000_000:
        return f"{num / 1_000_000_000:.1f}B".rstrip("0").rstrip(".") + ("B" if "." not in f"{num / 1_000_000_000:.1f}" else "")
    elif num >= 1_000_000:
        return f"{num / 1_000_000:.1f}M"
    elif num >= 1_000:
        return f"{num / 1_000:.1f}K"
    else:
        return str(int(num))

# ───── Stattdessen: Super einfache & sichere Thumbnail-Logik ─────
def set_thumbnail_if_valid(embed: discord.Embed, url: str | None):
    """
    Setzt das Thumbnail nur, wenn eine gültige URL vorhanden ist.
    Discord ignoriert automatisch kaputte Links → kein Crash, kein leeres Bild.
    """
    if url and isinstance(url, str) and url.strip():
        # Optional: ganz kleine Absicherung gegen offensichtlichen Müll
        if url.startswith(("http://", "https://")):
            embed.set_thumbnail(url=url.strip())
        # Wenn's kein http(s) ist → ignorieren

# ───── Autocomplete (stabil & schnell) ─────
async def item_autocomplete(interaction: discord.Interaction, current: str) -> List[app_commands.Choice[str]]:
    try:
        if not ITEM_NAMES:
            return []
        current_lc = (current or "").lower().strip()
        if not current_lc:
            suggestions = ITEM_NAMES[:MAX_SUGGEST]
        else:
            matches = [n for n in ITEM_NAMES if current_lc in n.lower()]
            matches.sort(key=lambda x: (not x.lower().startswith(current_lc), x.lower()))
            suggestions = matches[:MAX_SUGGEST]
        return [app_commands.Choice(name=name, value=name) for name in suggestions]
    except Exception as e:
        print(f"[AUTOCOMPLETE ERROR] {e}")
        return []

# ───── Autocomplete für Rarity-Namen ─────
async def rarity_autocomplete(interaction: discord.Interaction, current: str) -> List[app_commands.Choice[str]]:
    rarities = set(data.get("rarity") for data in ITEM_DB.values() if data.get("rarity"))
    matches = [r for r in rarities if current.lower() in r.lower()]
    matches.sort()
    return [app_commands.Choice(name=r, value=r) for r in matches[:25]]

# ───── Autocomplete für Index-Namen ─────
async def index_autocomplete(interaction: discord.Interaction, current: str) -> List[app_commands.Choice[str]]:
    indexes = OWN_INDEXES
    matches = [idx for idx in indexes if current.lower() in idx.lower()]
    matches.sort()
    return [app_commands.Choice(name=idx, value=idx) for idx in matches[:25]]

# ───── Autocomplete für Types ─────
async def type_autocomplete(interaction: discord.Interaction, current: str) -> List[app_commands.Choice[str]]:
    types = set()
    for data in ITEM_DB.values():
        t = data.get("type")
        if t:
            if isinstance(t, str):
                types.update([x.strip() for x in t.split(",") if x.strip()])
            elif isinstance(t, list):
                types.update(t)
    matches = [t for t in types if current.lower() in t.lower()]
    matches.sort()
    return [app_commands.Choice(name=t, value=t) for t in matches[:25]]

#  🐨 🟡 💎 🌈 ☢️ 🧪  🌑 ☯︎ 

INDEX_EMOJIS = {
    "Normal": '🐨',      # Grau
    "Gold": '🟡',        # Goldgelb
    "Diamond": '💎',     # Hellblau/Cyan
    "Candy": '🍬',       # Pink
    "Rainbow": '🌈',     # Rot (wir simulieren Regenbogen mit Text)
    "Radioactive": '🧪', # Giftgrün
    "Galaxy": '🌑',      # Lila
    "YinYang":'☯︎'       # Schwarz/Weiß
}

RARITY_EMOJIS = {
    "Common": '🟢',
    "Rare": '🔵',
    "Epic": '🟣',
    "Legendary": '🟡',
    "Mythical": '🔴',
    "Brainrot God": '🌏',
    "Secret": '⚫️',
    "OG":'🎊'
}

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)


def format_index_with_emoji(index: str) -> str:
    emoji = INDEX_EMOJIS.get(index, '⚪️')  # fallback
    return f"{emoji} `{index}`"

# ────────────────────────────────────── Cog ──────────────────────────────────────
class Brainrot(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    # ───────────────────── Hauptgruppe /brainrot ─────────────────────
    group = app_commands.Group(name="brainrot", description="Alles rund um Brainrot-Items")

    # ───── info ─────
    @group.command(name="info", description="Zeige Infos zu einem Item")
    @app_commands.describe(item="Name des Items")
    @app_commands.autocomplete(item=item_autocomplete)
    async def info(self, interaction: discord.Interaction, item: str):
        await interaction.response.defer()
        data = ITEM_DB.get(item)
        if not data:
            await interaction.followup.send(f"**{item}** nicht gefunden.", ephemeral=True)
            return

        embed = discord.Embed(
            title=item,
            color=discord.Color.blurple())

        embed.add_field(name="Rarity", value=data.get("rarity", "—"), inline=True)
        embed.add_field(name="Income/s", value=format_number(data.get("wert")), inline=True)
        embed.add_field(name="Cost", value=format_number(data.get("kosten")), inline=True)

        if img := data.get("image"):
            if img.startswith(("http://", "https://")):
                embed.set_thumbnail(url=img)

        # Besitz anzeigen
        owned = OWN_DB.get(str(interaction.user.id), {}).get(item, [])
        if owned:
            # Coolste zuerst sortieren
            order = ["Normal", "Gold", "Diamond", "Candy", "Rainbow", "Galaxy", "YinYang", "Radioactive"]
            owned_sorted = sorted(owned, key=lambda x: order.index(x) if x in order else 999)

            colored_indexes = [format_index_with_emoji(idx) for idx in owned_sorted]

            embed.add_field(
                name="Your possessions",
                value=" ".join(colored_indexes),
                inline=False
            )

        await interaction.followup.send(embed=embed)

    @group.command(name="type", description="Show all brainrots of a specific type")
    @app_commands.describe(
        type="The type (e.g. Fishing, Halloween)",
        public="If True, everyone in the channel can see the result. Default is private."
    )
    @app_commands.autocomplete(type=type_autocomplete)
    async def type_command(self, interaction: discord.Interaction, type: str, public: bool = False):
        # Hier nutzen wir das 'public' Argument. Wenn public=False, dann ist ephemeral=True.
        is_ephemeral = not public
        await interaction.response.defer(ephemeral=is_ephemeral)

        # Suche Items, die den Type in ihrer Liste haben
        items_of_type = []
        for name, data in ITEM_DB.items():
            types = data.get("type", [])
            if isinstance(types, str):
                types = [x.strip() for x in types.split(",") if x.strip()]
            if type.lower() in [t.lower() for t in types]:
                items_of_type.append((name, data))

        if not items_of_type:
            # Wichtig: followup muss auch wissen, ob es privat sein soll
            await interaction.followup.send(f"No brainrots found with type **{type}**.", ephemeral=is_ephemeral)
            return

        # Sortierung & Formatierung (unverändert)
        items_of_type.sort(key=lambda x: x[1].get("wert", 0), reverse=True)

        limit = 30 # Hinweis: Discord Embeds haben Zeichenlimits, bei 70 Items wird es oft zu lang
        total = len(items_of_type)
        lines = []

        for i, (name, data) in enumerate(items_of_type[:limit], 1):
            wert = format_number(data.get("wert", 0))
            rarity = data.get("rarity", "❔")
            emoji = RARITY_EMOJIS.get(rarity, "❔")
            
            item_types = data.get("type", [])
            if isinstance(item_types, str):
                item_types = [x.strip() for x in item_types.split(",")]
            types_str = ", ".join(item_types)
            lines.append(f"`{i:2}.` {emoji} **{name}** • {wert} • _{types_str}_")

        if total > limit:
            lines.append(f"\n... and **{total - limit} more**")

        embed = discord.Embed(
            title=f"{type.capitalize()} Brainrots",
            description="\n".join(lines),
            color=0x3498db
        )
        embed.set_footer(text=f"Total: {total} • Sorted by value")

        if items_of_type:
            top_img = items_of_type[0][1].get("image")
            if top_img and top_img.startswith(("http://", "https://")):
                embed.set_thumbnail(url=top_img)

        # Finales Senden - nutzt den Status von is_ephemeral
        await interaction.followup.send(embed=embed, ephemeral=is_ephemeral)


    # ───── add ─────
    @group.command(name="add", description="Add mutation of an item to your inventory")
    @app_commands.describe(item="Item", index="Mutations (Normal, Gold, ...)")
    @app_commands.autocomplete(item=item_autocomplete)
    @app_commands.autocomplete(index=index_autocomplete)
    async def add(self, interaction: discord.Interaction, item: str, index: str):
        if item not in ITEM_DB:
            await interaction.response.send_message("Item does not exist.", ephemeral=True)
            return
        if index not in OWN_INDEXES:
            await interaction.response.send_message(
                f"Invalid index! Possible indexes: {', '.join(OWN_INDEXES)}", ephemeral=True
            )
            return
        
        user_id = str(interaction.user.id)
        user_items = OWN_DB.setdefault(user_id, {})

        if item not in user_items or not isinstance(user_items[item], list):
            user_items[item] = []

        current = user_items[item]

        if index in current:
            await interaction.response.send_message(f"You already have **{item}** in your **{index}**!", ephemeral=True)
            return

        current.append(index)
        save_json(OWN_FILE, OWN_DB)
        await interaction.response.send_message(f"**Added {item}** to **{index}**!", ephemeral=True)

    # ───── MASSE ADD (z.B. alle Common als Gold) ─────
    @group.command(name="massadd", description="Add all items of a rarity to your inventory in a specific index")
    @app_commands.describe(rarity="Rarity (e.g. common, secret)", index="index (gold, diamond, ...)")
    @app_commands.autocomplete(rarity=rarity_autocomplete)
    async def bulk_add(self, interaction: discord.Interaction, rarity: str, index: str):
        if index not in OWN_INDEXES:
            await interaction.response.send_message(
                f"Invalid index! Possible indexes: {', '.join(OWN_INDEXES)}", ephemeral=True
            )
            return

        # Zähle, wie viele Items der Rarity existieren
        items_of_rarity = [name for name, data in ITEM_DB.items() if data.get("rarity") == rarity]
        if not items_of_rarity:
            await interaction.response.send_message(f"No items found with rarity **{rarity}**.", ephemeral=True)
            return

        user_id = str(interaction.user.id)
        user_items = OWN_DB.setdefault(user_id, {})

        added = 0
        already_had = 0

        for item_name in items_of_rarity:
            current = user_items.setdefault(item_name, [])
            if index not in current:
                current.append(index)
                added += 1
            else:
                already_had += 1

        save_json(OWN_FILE, OWN_DB)

        await interaction.response.send_message(
            f"**mass add successful!**\n"
            f"{INDEX_EMOJIS.get(index, '⚪️')} **{index}** added to **{added}** items of rarity **{rarity}**!\n"
            f"{already_had} did already have it.",
            ephemeral=True
        )

    # ───── MASSE REMOVE (z.B. alle Common aus Gold entfernen) ─────
    @group.command(name="massremove", description="Remove a specific index from all items of a rarity")
    @app_commands.describe(
        rarity="Rarity (e.g. Common, Secret, OG – case insensitive)",
        index="Index to remove (gold, diamond, ...)"
    )
    @app_commands.autocomplete(rarity=rarity_autocomplete)
    async def bulk_remove(self, interaction: discord.Interaction, rarity: str, index: str):
        if index not in OWN_INDEXES:
            await interaction.response.send_message(
                f"Invalid index! Possible indexes: {', '.join(OWN_INDEXES)}",
                ephemeral=True
            )
            return

        # Alle Items der Rarity finden (case-insensitive)
        items_of_rarity = [
            name for name, data in ITEM_DB.items()
            if data.get("rarity", "").lower() == rarity.lower()
        ]

        if not items_of_rarity:
            await interaction.response.send_message(
                f"No items found with rarity **{rarity}**.",
                ephemeral=True
            )
            return

        user_id = str(interaction.user.id)
        user_items = OWN_DB.setdefault(user_id, {})

        removed = 0
        not_had = 0

        for item_name in items_of_rarity:
            current_indexes = user_items.get(item_name, [])
            if index in current_indexes:
                current_indexes.remove(index)
                removed += 1

                # Wenn das Item jetzt keinen Index mehr hat → komplett entfernen (sauberer DB)
                if not current_indexes:
                    del user_items[item_name]
            else:
                not_had += 1

        save_json(OWN_FILE, OWN_DB)

        await interaction.response.send_message(
            f"**Mass remove successful!**\n"
            f"{INDEX_EMOJIS.get(index, '⚪️')} **{index}** removed from **{removed}** items of rarity **{rarity}**!\n"
            f"{not_had} items did not have this index.",
            ephemeral=True
        )

    # ───── remove ─────
    @group.command(name="remove", description="Remove mutation of an item from your inventory")
    @app_commands.describe(item="Item")
    @app_commands.autocomplete(item=item_autocomplete)
    async def remove(self, interaction: discord.Interaction, item: str):
        user_id = str(interaction.user.id)
        owned = OWN_DB.get(user_id, {}).get(item, [])
        if not owned:
            await interaction.response.send_message(f"You don't have **{item}**.", ephemeral=True)
            return

        view = RemoveView(item, owned, user_id)
        await interaction.response.send_message(
            f"Remove which mutation of **{item}** ?",
            view=view,
            ephemeral=True
        )


    # Optional: Statistiken pro Rarity
    @group.command(name="raritystats", description="Show stats of your collection by rarity and mutations")
    async def rarity_stats(self, interaction: discord.Interaction):
        user_id = str(interaction.user.id)
        owns = OWN_DB.get(user_id, {})
        
        # Zähle pro Rarity + Index
        stats = {}
        totals = {}

        for name, data in ITEM_DB.items():
            r = data.get("rarity", "Unknown")
            totals.setdefault(r, 0)
            totals[r] += 1

            if name in owns:
                stats.setdefault(r, {}).setdefault("total", 0)
                stats[r]["total"] += 1
                for idx in owns[name]:
                    stats[r].setdefault(idx, 0)
                    stats[r][idx] += 1

        embed = discord.Embed(title="Your collection with rarity and mutations", color=0x2ecc71)
        order = ["OG", "Secret", "Brainrot God", "Mythical", "Legendary", "Epic", "Rare", "Common"]

        for r in order:
            if r in totals:
                owned = stats.get(r, {}).get("total", 0)
                percent = owned / totals[r] * 100
                bar = "█" * int(percent//10) + "░" * (10 - int(percent//10))

                lines = [f"{bar} {owned}/{totals[r]} ({percent:.1f}%)"]
                if r in stats:
                    for idx in OWN_INDEXES:
                        count = stats[r].get(idx, 0)
                        if count > 0:
                            lines.append(f"   {INDEX_EMOJIS.get(idx, '⚪️')} `{idx}`: **{count}**")

                embed.add_field(name=r, value="\n".join(lines), inline=False)

        await interaction.response.send_message(embed=embed, ephemeral=True)

    # ───── INDEXSTATS – Wie viele von jedem Rarity hast du im gewählten Index? ─────
    @group.command(name="indexstats", description="Show stats of your collection by rarity in a specific index")
    @app_commands.describe(index="e.g. Gold, Diamond, Rainbow, Radioactive...")
    @app_commands.autocomplete(index=index_autocomplete)
    async def indexstats(self, interaction: discord.Interaction, index: str):
        if index not in OWN_INDEXES:
            await interaction.response.send_message(
                f"Invalid index! Possible indexes: {', '.join(OWN_INDEXES)}", 
                ephemeral=True
            )
            return

        user_id = str(interaction.user.id)
        owns = OWN_DB.get(user_id, {})

        # Zähle pro Rarity, wie viele Items der User im gewählten Index hat
        counts = {}
        totals = {}

        for name, data in ITEM_DB.items():
            rarity = data.get("rarity", "Unknown")
            totals[rarity] = totals.get(rarity, 0) + 1
            if name in owns and index in owns[name]:
                counts[rarity] = counts.get(rarity, 0) + 1

        if not any(counts.values()):
            await interaction.response.send_message(
                f"You have **no single brainrot** from {INDEX_EMOJIS.get(index, '⚪️')} `{index}`!", 
                ephemeral=True
            )
            return

        INDEX_COLORS = {
            "Normal": 0x95a5a6}

        embed = discord.Embed(
            title=f"Your brainrots from {INDEX_EMOJIS.get(index, '⚪️')} `{index}` index",
            color=INDEX_COLORS.get(index, 0x95a5a6) or 0x2ecc71
        )

        # Sortierung: coolste zuerst
        ordered_r = ["OG", "Secret", "Brainrot God", "Mythical", "Legendary", "Epic", "Rare", "Common"]

        total_owned = sum(counts.values())
        total_possible = sum(totals.get(rarity, 0) for rarity in ordered_r if totals.get(rarity, 0) > 0)

        embed.description = f"**{total_owned} brainrots** collected from `{index}`!"

        for rarity in ordered_r:
            if totals.get(rarity, 0) > 0:
                owned = counts.get(rarity, 0)
                percent = owned / totals[rarity] * 100
                bar = "█" * int(percent//10) + "░" * (10 - int(percent//10))
                emoji = RARITY_EMOJIS.get(rarity, "❔")

                embed.add_field(
                    name=f"{emoji} {rarity}",
                    value=f"{bar} **{owned}/{totals[rarity]}** ({percent:.1f}%)",
                    inline=False
                )

        embed.set_footer(text=f"{total_owned}/{total_possible} possible • Brainrot forever")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    # ───── MISSING – Alle fehlenden Pets für einen Index + Post-Button ─────
    @group.command(name="missing", description="Show all missing brainrots for a specific index")
    @app_commands.describe(
        index="The index (Gold, Diamond, etc.)",
        filter="Optional: 'all', 'secret', 'legendary', or '30-60' for page 2"
    )
    @app_commands.autocomplete(index=index_autocomplete)
    async def missing(self, interaction: discord.Interaction, index: str, filter: str = ''):
        if index not in OWN_INDEXES:
            await interaction.response.send_message(
                f"Invalid index! Possible indexes: {', '.join(OWN_INDEXES)}", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True)

        user_id = str(interaction.user.id)
        owns = OWN_DB.get(user_id, {})

        # Alle Pets, die der User noch NICHT als diesen Index hat
        missing_pets = []
        for name, data in ITEM_DB.items():
            if index == "Candy":
                item_sets = data.get("fixed_sets", [])
                if "Candy" not in item_sets:
                    continue  # Überspringe Items, die nicht zum Candy-Set gehören
            if name not in owns or index not in owns[name]:
                missing_pets.append((name, data))

        if not missing_pets:
                await interaction.response.send_message(
                    f"You have **ALL brainrots** in {INDEX_EMOJIS.get(index, '⚪️')} `{index}`!\n"
                    f"**LEGENDARY!**",
                    ephemeral=True
                )
                return

        # 1. Definiere die gewünschte Reihenfolge der Seltenheiten
        rarity_order = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Brainrot God", "Secret", "OG"]

        # 2. Sortiere erst nach Rarity-Index, dann nach Wert
        missing_pets.sort(key=lambda x: (
            rarity_order.index(x[1].get("rarity", "Common")) if x[1].get("rarity") in rarity_order else 99,
            x[1].get("wert", 0)
        ))

        display_items = missing_pets
        filter_start = 1

        if filter:
            filter_lower = filter.lower()
            if filter_lower == "all":
                # Alle anzeigen
                pass
            elif filter_lower in ["secret", "legendary", "mythical", "epic", "rare", "common"]:
                # Nur bestimmte Rarity
                display_items = [item for item in missing_pets if item[1].get("rarity", "").lower() == filter_lower]
            elif "-" in filter_lower:
                # z. B. "30-60"
                try:
                    start_str, end_str = filter_lower.split("-")
                    filter_start = int(start_str)
                    start = filter_start - 1  # 1-basiert → 0-basiert
                    end = int(end_str)
                    display_items = missing_pets[start:end]
                except:
                    await interaction.followup.send("Invalid range! Use e.g. `30-60`", ephemeral=True)
                    return
            else:
                await interaction.followup.send(
                    "Invalid filter! Use `all`, `secret`, `legendary`, or `30-60`", ephemeral=True)
                return

        total_missing = len(missing_pets) # Gesamtzahl der fehlenden (im gewählten Index)
        limit = 70
        lines = []

        for i, (name, data) in enumerate(display_items[:limit], 1):
            number_str = int(filter_start) + i - 1
            rarity = data.get("rarity", "❔")
            emoji = RARITY_EMOJIS.get(rarity, "❔")
            lines.append(f"`{number_str:2}.` {emoji} **{name}**")

        if len(display_items) > limit:
            lines.append(f"\n... and **{len(display_items) - limit} more** filtered results")

        title_suffix = ""
        if filter:
            if filter.lower() == "all":
                title_suffix = " (ALL)"
            elif filter.lower() in ["secret", "legendary", "mythical", "epic", "rare", "common"]:
                title_suffix = f" ({filter.capitalize()} only)"
            elif "-" in filter:
                title_suffix = f" (Nr. {filter})"

        embed = discord.Embed(
            title=f"Missing brainrots of {INDEX_EMOJIS.get(index, '⚪️')} `{index}`{title_suffix}",
            description="\n".join(lines),
            color=0xe74c3c
        )
        embed.set_footer(text=f"Total missing: {total_missing} • Showing {len(display_items)}")

        if display_items:
            top_img = display_items[0][1].get("image")
            if top_img and top_img.startswith(("http://", "https://")):
                embed.set_thumbnail(url=top_img)

        await interaction.followup.send(embed=embed, ephemeral=True)

    # ───── INTERACTIVE EDITOR – Toggle Items per Button! ─────
    @group.command(name="editor", description="Interactively add/remove items for a specific index")
    @app_commands.describe(index="The index you want to edit (Gold, Diamond, etc.)")
    @app_commands.autocomplete(index=index_autocomplete)
    async def editor(self, interaction: discord.Interaction, index: str):
        if index not in OWN_INDEXES:
            await interaction.response.send_message(
                f"Invalid index! Possible: {', '.join(OWN_INDEXES)}", ephemeral=True)
            return

        # 1. Filterung: Nur Items anzeigen, die für diesen Index gültig sind
        filtered_items = []
        for name, data in ITEM_DB.items():
            if index == "Candy":
                # Nur Items, die das Candy-Tag haben
                if "Candy" in data.get("fixed_sets", []):
                    filtered_items.append((name, data))
            else:
                # Für alle anderen Indizes (Gold, Radioactive etc.) alle Items nehmen
                filtered_items.append((name, data))

        # Sortierung: Zuerst nach Rarity (Reihenfolge wie im Spiel), dann absteigend nach Wert
        rarity_order = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Brainrot God", "Secret", "OG"]
        
        # Sortier-Funktion: Erst Rarity-Index, dann Wert
        def sort_key(item_tuple):
            name, data = item_tuple
            r = data.get("rarity", "Common")
            r_idx = rarity_order.index(r) if r in rarity_order else 99
            return (r_idx, data.get("wert", 0)) # -wert für absteigend innerhalb der Rarity

        filtered_items.sort(key=sort_key)
        
        # Nur die Namen für die View extrahieren
        final_item_names = [name for name, _ in filtered_items]
        
        items_per_page = 16
        user_id = str(interaction.user.id)
        owns = OWN_DB.get(user_id, {})

        # Nachricht senden und View starten
        await interaction.response.send_message(embed=discord.Embed(title="Loading Editor..."), ephemeral=True)
        sent_message = await interaction.original_response()

        # Nutze die gefilterte Liste final_item_names statt ITEM_DB.items()
        view = ItemEditorView(final_item_names, index, owns, user_id, items_per_page)
        await view.send_page(sent_message, 0)


class ItemEditorView(discord.ui.View):
    def __init__(self, all_items, index, owns, user_id, items_per_page=20):
        super().__init__(timeout=600)
        self.all_items = all_items
        self.index = index
        self.owns = owns
        self.user_id = user_id
        self.items_per_page = items_per_page
        self.current_page = 0
        self.total_pages = (len(all_items) + items_per_page - 1) // items_per_page

    async def send_page(self, message: discord.Message | None, page: int):
        self.current_page = page
        start = page * self.items_per_page
        end = start + self.items_per_page
        page_items = self.all_items[start:end]

        # Fortschritt berechnen: Wie viele der gefilterten Items besitzt der User?
        owned_count = 0
        for name in self.all_items:
            if name in self.owns and self.index in self.owns[name]:
                owned_count += 1

        total_count = len(self.all_items)
        percentage = (owned_count / total_count * 100) if total_count > 0 else 0

        # Update buttons
        self.clear_items()
        
        '''
        # Navigation
        if self.total_pages > 1:
            if page > 0:
                prev = discord.ui.Button(label="◀", style=discord.ButtonStyle.blurple, row=0)
                prev.callback = lambda i: self._page_callback(i, message, page - 1)
                self.add_item(prev)
            else:
                spacer = discord.ui.Button(label="◀", style=discord.ButtonStyle.gray, row=0, disabled=True)
                self.add_item(spacer)

            if page < self.total_pages - 1:
                next_btn = discord.ui.Button(label="▶", style=discord.ButtonStyle.blurple, row=0)
                next_btn.callback = lambda i: self._page_callback(i, message, page + 1)
                self.add_item(next_btn)
            else:
                spacer = discord.ui.Button(label="▶", style=discord.ButtonStyle.gray, row=0, disabled=True)
                self.add_item(spacer)
        '''

        # Navigation Buttons (Row 0)
        if self.total_pages > 1:
            # Zurück Button
            prev_style = discord.ButtonStyle.blurple if page > 0 else discord.ButtonStyle.gray
            prev = discord.ui.Button(label="◀", style=prev_style, row=0, disabled=(page == 0))
            prev.callback = lambda i: self._page_callback(i, message, page - 1)
            self.add_item(prev)

            # Weiter Button
            next_style = discord.ButtonStyle.blurple if page < self.total_pages - 1 else discord.ButtonStyle.gray
            next_btn = discord.ui.Button(label="▶", style=next_style, row=0, disabled=(page == self.total_pages - 1))
            next_btn.callback = lambda i: self._page_callback(i, message, page + 1)
            self.add_item(next_btn)

        # Item Buttons (Ab Row 1)
        row = 1
        MAX_NAME_LEN = 28
        PADDING_CHAR = " "

        for i, name in enumerate(page_items):
            has_it = name in self.owns and self.index in self.owns[name]
            status = INDEX_EMOJIS.get(self.index, '⚪️') if has_it else '⚫️'
            style = discord.ButtonStyle.success if has_it else discord.ButtonStyle.secondary

            display_name = name[:MAX_NAME_LEN]
            #label = f"{name:<{button_width}}".replace(" ", " ")
            padded_name = display_name + PADDING_CHAR * (MAX_NAME_LEN - len(display_name))
            label = f"{padded_name}"
            btn = discord.ui.Button(label=label, style=style, row=row, custom_id=f"toggle_{name}")

            async def toggle(inter: discord.Interaction, n=name, b=btn):
                await inter.response.defer()

                user_owns = OWN_DB.setdefault(self.user_id, {})
                item_entry = user_owns.setdefault(n, [])

                if self.index in item_entry:
                    item_entry.remove(self.index)
                    if not item_entry:
                        user_owns.pop(n, None)
                    #b.style = discord.ButtonStyle.secondary
                else:
                    if self.index not in item_entry:
                        item_entry.append(self.index)
                    #b.style = discord.ButtonStyle.success

                save_json(OWN_FILE, OWN_DB)
                await self.send_page(message, self.current_page)

            btn.callback = toggle
            self.add_item(btn)
            
            if (i + 1) % 4 == 0:
                row += 1

        index_emoji = INDEX_EMOJIS.get(self.index, '⚪️')

        # Liste der Items auf der Seite
        lines = []
        for name in page_items:
            has_it = name in self.owns and self.index in self.owns[name]
            status_emoji = index_emoji if has_it else '⚫️'
            lines.append(f"{status_emoji} `{name}`")

        embed = discord.Embed(
            title=f"Editor: {index_emoji} `{self.index}`",
            description=f"**Progress: {owned_count}/{total_count} ({percentage:.1f}%)**\n\n" + "\n".join(lines),
            color=0x2ecc71
        )
        embed.set_footer(text=f"Page {page + 1}/{self.total_pages} • Click to toggle possession")


        # Nachricht rendern
        await message.edit(embed=embed, view=self)


    async def _page_callback(self, inter: discord.Interaction, message, new_page):
        await inter.response.defer()  # <── FIX
        await self.send_page(message, new_page)


class PostPublicButton(discord.ui.View):
    def __init__(self, missing_pets: list, index: str, user: discord.User | discord.Member):
        super().__init__(timeout=300)
        self.missing_pets = missing_pets
        self.index = index
        self.user = user

        # Dynamic button – exactly like your working RemoveView
        btn = discord.ui.Button(
            label="Post in channel",
            style=discord.ButtonStyle.danger,
            emoji="Megaphone"
        )

        async def callback(interaction: discord.Interaction):
            await interaction.response.edit_message(view=None)

            lines = []
            for i, (name, data) in enumerate(self.missing_pets, 1):
                value = format_number(data.get("wert", 0))
                rarity = data.get("rarity", "❔")
                lines.append(f"`{i:3}.` **{name}** • {rarity} • {value}")

            embed = discord.Embed(
                title=f"{self.user.display_name}'s missing brainrots ({INDEX_EMOJIS.get(self.index, '⚪️')} `{self.index}`)",
                description="\n".join(lines),
                color=0xe74c3c
            )
            embed.set_footer(text=f"{len(self.missing_pets)} missing • posted by {self.user.display_name}")
            embed.set_thumbnail(url=self.user.display_avatar.url)

            await interaction.followup.send(embed=embed)

        btn.callback = callback
        self.add_item(btn)


# ───── Remove-Button-View ─────
class RemoveView(discord.ui.View):
    def __init__(self, item: str, indexes: list, user_id: str):
        super().__init__(timeout=60)
        self.item = item
        self.user_id = user_id

        for idx in indexes:
            btn = discord.ui.Button(label=idx, style=discord.ButtonStyle.danger)
            async def cb(interaction: discord.Interaction, i=idx):
                OWN_DB.setdefault(self.user_id, {}).setdefault(self.item, []).remove(i)
                if not OWN_DB[self.user_id][self.item]:
                    OWN_DB[self.user_id].pop(self.item, None)
                if not OWN_DB[self.user_id]:
                    OWN_DB.pop(self.user_id, None)
                save_json(OWN_FILE, OWN_DB)
                await interaction.response.edit_message(content=f"Removed **{i}** mutation of **{self.item}**.", view=None)
            btn.callback = cb
            self.add_item(btn)

async def safe_post(interaction: discord.Interaction, content: str):
    if hasattr(interaction.channel, "send"):
        try:
            return await interaction.channel.send(content)
        except:
            pass
    # Fallback: followup (öffentlich!)
    try:
        return await interaction.followup.send(content, ephemeral=False)
    except:
        return None

# ───── Setup ─────
async def setup(bot):
    await bot.add_cog(Brainrot(bot))

@bot.event
async def on_ready():
    print(f"Bot online → {bot.user}")
    GUILD_ID = 1440275499661394074  # Setze hier eine Guild-ID für schnelle Tests, oder None für global
    GUILD_ID_2 = 1444435956538277898
    #await bot.tree.clear_commands(guild=None)
    #await bot.tree.sync()
    #print("Slash-Commands ready!")


    #guild2 = discord.Object(id=GUILD_ID_2)
    #bot.tree.copy_global_to(guild=guild2)   # kopiert globale Befehle ins Guild
    #await bot.tree.sync(guild=guild2)       # ← Sofort-Update NUR auf diesem Server!
    #print(f"Commands refreshed on test server {GUILD_ID_2} !")
    
    guild = discord.Object(id=GUILD_ID)
    bot.tree.copy_global_to(guild=guild)   # kopiert globale Befehle ins Guild
    await bot.tree.sync(guild=guild)       # ← Sofort-Update NUR auf diesem Server!
    print(f"Commands refreshed on test server {GUILD_ID} !")


@bot.event
async def on_interaction(interaction: discord.Interaction):
    print("Interaction received:", interaction.type, interaction.data)


async def main():
    async with bot:
        await setup(bot)
        await bot.start(TOKEN)

if __name__ == "__main__":
    asyncio.run(main())