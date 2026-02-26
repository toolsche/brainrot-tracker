import json
import os
import io
import requests
from thefuzz import process, fuzz
from PIL import Image

# Dateipfade (Stelle sicher, dass die Dateien im selben Ordner liegen)
DB_FILE = r'D:\develop\brainrot-discord-app\images-dl\brainrot_db.json'
WIKI_FILE = r'D:\develop\brainrot-discord-app\images-dl\sab-fandom-links-new.json'
OUTPUT_FILE = 'final_matches.json'
DOWNLOAD_FOLDER = 'brainrot_images'

def load_data():
    with open(DB_FILE, 'r', encoding='utf-8') as f:
        db = json.load(f)
    with open(WIKI_FILE, 'r', encoding='utf-8') as f:
        wiki_data = json.load(f)
    return db, wiki_data['query']['pages']

def find_matches():
    db, wiki_pages = load_data()
    
    # Extrahiere alle Wiki-Titel und deren URLs
    wiki_titles = {page['title']: page.get('thumbnail', {}).get('source') 
                   for page in wiki_pages.values() if 'thumbnail' in page}
    
    wiki_title_list = list(wiki_titles.keys())
    final_results = []
    missing = []

    print(f"Abgleich von {len(db)} Datenbank-Einträgen mit {len(wiki_title_list)} Wiki-Bildern...")

    for name in db.keys():
        # 1. Versuche exakten Treffer
        if name in wiki_titles:
            final_results.append({"name": name, "url": wiki_titles[name], "match_type": "exact"})
            continue
            
        # 2. Unscharfe Suche (Fuzzy Matching)
        # Wir suchen den Titel im Wiki, der dem Namen in der DB am ähnlichsten ist
        best_match, score = process.extractOne(name, wiki_title_list, scorer=fuzz.token_sort_ratio)
        
        if score > 80: # 80% Ähnlichkeit als Schwellenwert
            final_results.append({"name": name, "url": wiki_titles[best_match], "match_type": f"fuzzy ({score}%)", "wiki_title": best_match})
        else:
            missing.append(name)

    # Ergebnisse speichern
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_results, f, indent=4)

    print(f"\nFertig!")
    print(f"Treffer gefunden: {len(final_results)}")
    print(f"Kein Bild gefunden für: {len(missing)}")
    print(f"Ergebnisse wurden in '{OUTPUT_FILE}' gespeichert.")
    
    if missing:
            print("\n❌ Folgende Einträge fehlen im Wiki (kein Bild gefunden):")
            for item in sorted(missing):
                print(f" - {item}")

    return final_results, missing

def download_images(matches):
    if not os.path.exists(DOWNLOAD_FOLDER):
        os.makedirs(DOWNLOAD_FOLDER)
    
    print(f"\nStarte Download und Konvertierung nach WebP...")
    for item in matches:
        # Formatierung: "Bambini Crostini" -> "bambini-crostini.webp"
        clean_name = item['name'].lower().strip().replace(" ", "-").replace("/", "-").replace("\\", "-")
        file_name = f"{clean_name}.webp"
        file_path = os.path.join(DOWNLOAD_FOLDER, file_name)
        
        try:
            response = requests.get(item['url'])
            if response.status_code == 200:
                # Bild konvertieren
                img = Image.open(io.BytesIO(response.content))
                img.save(file_path, "WEBP", quality=80)
                print(f"✅ Gespeichert: {file_name}")
            else:
                print(f"❌ Download-Fehler ({response.status_code}): {item['name']}")
        except Exception as e:
            print(f"⚠️ Fehler bei {item['name']}: {e}")

if __name__ == "__main__":
    results, missing_list = find_matches()
    
    if results:
        choice = input("\nMöchtest du die gefundenen Bilder jetzt herunterladen und konvertieren? (j/n): ")
        if choice.lower() == 'j':
            download_images(results)