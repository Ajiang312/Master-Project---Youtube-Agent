# TubeAI Dashboard - Guide d'installation avec Supabase

## 📋 Prérequis

- Un compte Supabase avec votre projet configuré
- Vos tables : `channels`, `comments`, `transcript_jobs`, `transcripts`, `videos`

## 🔑 Étape 1 : Récupérer vos clés Supabase

1. Allez sur votre dashboard Supabase : https://supabase.com/dashboard/project/rtztgwuqzaoytkyencei

2. Cliquez sur **Settings** (icône roue dentée) dans la barre latérale gauche

3. Cliquez sur **API**

4. Vous trouverez deux informations importantes :
   - **Project URL** : `https://rtztgwuqzaoytkyencei.supabase.co`
   - **anon public key** : une longue clé qui commence par `eyJ...`

5. **Copiez ces deux valeurs**, vous en aurez besoin !

## 📁 Étape 2 : Structure des fichiers

Créez un dossier `tubeai/` avec cette structure :

```
tubeai/
├── login.html              ← Page de connexion (NOUVELLE)
├── login-style.css         ← Style de la page de connexion
├── login.js                ← Script de connexion
├── index.html              ← Dashboard principal
├── style.css
├── script.js
├── supabase-config.js
├── dashboard.js
└── README.md
```

## ⚙️ Étape 3 : Configuration de Supabase

1. Ouvrez le fichier `supabase-config.js`

2. Remplacez les valeurs par vos clés :

```javascript
const SUPABASE_URL = 'https://rtztgwuqzaoytkyencei.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_CLE_ANON_KEY_ICI'; // Collez votre clé ici
```

**Exemple :**
```javascript
const SUPABASE_URL = 'https://rtztgwuqzaoytkyencei.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0enRnd3VxemFveXRreWVuY2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODMyMDg4OTksImV4cCI6MTk5ODc4NDg5OX0.xxxxxxxxxxxxx';
```

## 🔒 Étape 4 : Configurer les permissions (RLS)

Pour que votre site puisse lire les données, vous devez configurer les Row Level Security (RLS) dans Supabase :

1. Allez dans **Authentication** > **Policies**
2. Pour chaque table (`videos`, `channels`, `comments`, etc.), ajoutez une policy :

**Pour la lecture publique (développement) :**
```sql
-- Dans le SQL Editor de Supabase
-- Pour la table videos
CREATE POLICY "Enable read access for all users" ON "public"."videos"
FOR SELECT USING (true);

-- Pour la table channels
CREATE POLICY "Enable read access for all users" ON "public"."channels"
FOR SELECT USING (true);

-- Pour la table comments
CREATE POLICY "Enable read access for all users" ON "public"."comments"
FOR SELECT USING (true);

-- Pour la table transcripts
CREATE POLICY "Enable read access for all users" ON "public"."transcripts"
FOR SELECT USING (true);

-- Pour la table transcript_jobs
CREATE POLICY "Enable read access for all users" ON "public"."transcript_jobs"
FOR SELECT USING (true);
```

⚠️ **Important** : En production, vous devriez restreindre ces permissions selon vos besoins.

## 🚀 Étape 5 : Lancer le site

### Option 1 : Avec un serveur local

Si vous avez Python installé :
```bash
cd tubeai
python -m http.server 8000
```

Puis ouvrez : **http://localhost:8000/login.html** (pas index.html !)

### Option 2 : Avec VS Code

1. Installez l'extension "Live Server"
2. Clic droit sur `login.html` > "Open with Live Server"

### Option 3 : Double-clic

Ouvrez directement `login.html` dans votre navigateur (peut avoir des limitations avec Supabase)

## ✅ Flux d'utilisation

1. 📱 **Ouvrez login.html** - Vous verrez toutes vos chaînes YouTube disponibles
2. 🔍 **Recherchez ou sélectionnez une chaîne** - Tapez dans la barre de recherche ou cliquez sur une carte
3. ✅ **Cliquez sur une chaîne** - Vous serez automatiquement redirigé vers le dashboard
4. 📊 **Consultez vos stats** - Le dashboard affiche les données de LA chaîne sélectionnée
5. 🔄 **Changez de chaîne** - Cliquez sur "Changer de chaîne" en haut du dashboard

## ✅ Vérification

Une fois sur **login.html**, vous devriez voir :

1. ✅ La liste de toutes vos chaînes YouTube chargées depuis Supabase
2. ✅ Une barre de recherche fonctionnelle
3. ✅ Possibilité de cliquer sur une chaîne pour accéder à son dashboard

Une fois sur le **dashboard** (index.html) :

1. ✅ Le nom de votre chaîne sélectionnée s'affiche en haut
2. ✅ Les statistiques se chargent automatiquement pour CETTE chaîne uniquement
3. ✅ Les vidéos récentes de cette chaîne s'affichent
4. ✅ Un bouton "Changer de chaîne" pour revenir à la sélection
5. ✅ Pas d'erreurs dans la console (F12 > Console)

## 🐛 En cas de problème

### Erreur : "Failed to fetch"

**Vérifiez dans la console (F12) :**

1. Que votre `SUPABASE_ANON_KEY` est bien configurée
2. Que les policies RLS sont activées pour vos tables

### Aucune donnée ne s'affiche

1. Vérifiez que vous avez des données dans vos tables Supabase
2. Ouvrez la console (F12) et regardez les erreurs
3. Testez dans le SQL Editor de Supabase :

```sql
SELECT * FROM videos LIMIT 5;
```

### Les stats affichent "0" ou "..."

C'est normal si vos tables sont vides. Ajoutez des données de test dans Supabase.

## 📊 Structure des données attendue

Vos tables Supabase devraient contenir au minimum ces colonnes :

### Table `videos`
- `id` (uuid ou int)
- `title` (text)
- `view_count` (int)
- `like_count` (int)
- `comment_count` (int)
- `created_at` (timestamp)
- `channel_id` (foreign key)

### Table `channels` ⭐ IMPORTANT
- `id` (uuid ou int) - Clé primaire
- `title` (text) - **Nom de la chaîne YouTube** ⚠️ Requis pour la connexion
- `subscriber_count` (int) - Nombre d'abonnés (optionnel)
- `video_count` (int) - Nombre de vidéos (optionnel)
- `thumbnail_url` (text) - URL de l'avatar (optionnel)
- `description` (text) - Description (optionnel)

### Table `comments`
- `id` (uuid ou int)
- `video_id` (foreign key)
- `text` (text)
- `created_at` (timestamp)

## 🔐 Sécurité

⚠️ **Ne commitez JAMAIS votre clé Supabase sur GitHub !**

Pour protéger vos clés :

1. Créez un fichier `.env` ou `config.js` (non versionné)
2. Ajoutez ce fichier à `.gitignore`
3. Utilisez des variables d'environnement en production

## 📞 Support

Si vous avez des questions :
1. Vérifiez les logs dans la console (F12)
2. Consultez la documentation Supabase : https://supabase.com/docs
3. Vérifiez que vos tables ont bien les données attendues

## 🎉 C'est tout !

Votre dashboard TubeAI est maintenant connecté à Supabase et affiche vos données en temps réel !