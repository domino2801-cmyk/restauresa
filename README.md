# RestauResa

Application web progressive (PWA) de **réservation de repas en milieu militaire**,
construite avec **React + Vite + Tailwind CSS** et intégrée à **Supabase**
(base de données PostgreSQL, authentification, Row Level Security).

## Fonctionnalités

### Authentification (Supabase Auth)

| Écran | Description |
| --- | --- |
| **Inscription** (`/register`) | Régiment, Compagnie, Section (listes en cascade), Nom, Adresse mail personnelle, Mot de passe. La soumission déclenche l'envoi d'un **code OTP à 6 chiffres** par email. |
| **Validation OTP** (`/verify`) | Saisie du code (6 cases, collage supporté, renvoi du code après 60 s). Finalise l'inscription. |
| **Connexion** (`/login`) | **Nom ou email** + mot de passe, bouton **« Mot de passe oublié ? »**. |
| **Mot de passe oublié** (`/forgot-password`) | Envoi d'un lien de réinitialisation par email. |
| **Nouveau mot de passe** (`/reset-password`) | Page de destination du lien de réinitialisation. |
| **Compte en attente** (`/pending`) | Affichée tant qu'un administrateur n'a pas validé le compte. |

### Interfaces par rôle (table `profiles`)

| Rôle | Accueil | Contenu |
| --- | --- | --- |
| **Administrateur** (`admin`) | `/admin` | Vue d'ensemble analytique (KPIs, réservations par jour, taux par compagnie, coût estimé) ; gestion des **utilisateurs** (validation, rôle, régiment/compagnie/section, suppression du compte via la fonction `admin_delete_user`) ; gestion de l'**organisation** ; **catalogue des repas** ; **menus de la semaine**. |
| **ADU** – Adjudant de compagnie (`adu`) | `/adu` | Qui a réservé dans sa compagnie (par date et service), **triable par section / nom / statut**, filtre réservés / non réservés, synthèse par section, pointage de présence, **export CSV** et **validation de l'effectif** transmis aux cuisines. |
| **CDU** – Commandant de compagnie (`cdu`) | `/cdu` | KPIs (taux de réservation, **taux de présence**, coût estimé, effectifs à approuver), graphiques par jour et par section, **revue des effectifs** (approbation / rejet motivé). |
| **Militaire** (`user`) | `/reservations` | Réservation / annulation des repas de la semaine. Accessible aussi aux autres rôles via « Mes repas ». |

### PWA

- Manifest + service worker générés par `vite-plugin-pwa` (Workbox) : application
  **installable** sur smartphone, ressources pré-cachées, mise à jour automatique.
- Les lectures de l'API Supabase sont mises en cache (stratégie *network first*) pour
  une consultation hors-ligne des dernières données. Ce cache est purgé à la
  déconnexion (manuelle ou expiration de session) afin de ne pas exposer ces données
  à un autre utilisateur du même appareil.
- Icônes générées depuis `public/favicon.svg` (`npm run generate-pwa-assets`).

## Structure

```
├── public/                      # Icônes PWA, favicon
├── src/
│   ├── components/
│   │   ├── layout/              # AppLayout (bandeau + navigation), AuthLayout, Logo
│   │   ├── ui/                  # Button, Input/Select, Card/StatCard, Alert, Badge…
│   │   ├── OtpInput.jsx         # Saisie du code OTP à 6 chiffres
│   │   ├── OrgSelectors.jsx     # Régiment > Compagnie > Section en cascade
│   │   ├── ProtectedRoute.jsx   # Garde d'authentification / validation / rôle
│   │   └── WeekNavigator.jsx
│   ├── contexts/                # AuthProvider (session + profil)
│   ├── hooks/                   # useAuth, useAsync, useOrganization
│   ├── lib/                     # Client Supabase, constantes, dates, stats, CSV, validation
│   ├── services/                # Requêtes Supabase (auth, profils, organisation, repas, réservations)
│   ├── pages/
│   │   ├── auth/                # Connexion, inscription, OTP, mot de passe oublié / nouveau
│   │   ├── admin/               # Interface Administrateur (onglets)
│   │   ├── adu/                 # Interface ADU
│   │   ├── cdu/                 # Interface CDU
│   │   └── user/                # Mes repas
│   └── App.jsx                  # Routage
└── supabase/
    ├── config.toml              # Config CLI (OTP 6 chiffres, template email, fonctions)
    ├── migrations/              # Schéma, triggers, fonctions et politiques RLS
    ├── functions/login-by-name/ # Edge Function : connexion par nom
    ├── templates/               # Email de confirmation contenant le code OTP
    └── seed.sql                 # Données de démonstration
```

## Démarrage

Prérequis : Node.js 20+ et un projet Supabase (ou le [CLI Supabase](https://supabase.com/docs/guides/cli) avec Docker).

```bash
npm install
cp .env.example .env.local      # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev                     # http://localhost:5173
```

Autres commandes :

```bash
npm run build      # build de production (+ service worker) dans dist/
npm run preview    # sert le build (test de l'installation PWA)
npm run lint       # oxlint
npm test           # tests unitaires (Vitest + Testing Library)
```

## Déploiement sur GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` construit et publie l'application à chaque
push sur `main` (ou manuellement depuis l'onglet *Actions*). Dans *Settings > Secrets and
variables > Actions > Variables*, ajoutez :

- `VITE_SUPABASE_URL` : URL du projet Supabase ;
- `VITE_SUPABASE_ANON_KEY` : clé publique `anon` ou `publishable` du projet (jamais la
  clé `service_role`).

Dans *Settings > Pages*, sélectionnez **GitHub Actions** comme source de déploiement.
Le site sera publié à `https://domino2801-cmyk.github.io/restauresa/`. Le build configure
le sous-chemin du dépôt, le routage React, la PWA et un repli `404.html` pour les URL
internes de l'application.

Dans Supabase (*Authentication > URL Configuration*), définissez l'URL du site sur
`https://domino2801-cmyk.github.io/restauresa/` et ajoutez
`https://domino2801-cmyk.github.io/restauresa/reset-password` aux Redirect URLs. Appliquez
également les migrations et déployez la fonction `login-by-name` (voir la configuration
Supabase ci-dessous).

## Configuration Supabase

### 1. Base de données

Avec le CLI (local) :

```bash
npx supabase start          # applique supabase/migrations et supabase/seed.sql
```

Sur un projet hébergé : `npx supabase link --project-ref <ref>` puis `npx supabase db push`
(ou exécuter `supabase/migrations/*.sql` puis, éventuellement, `supabase/seed.sql`
dans l'éditeur SQL du tableau de bord).

### 2. Code OTP à l'inscription

Le flux utilise `supabase.auth.signUp()` puis `supabase.auth.verifyOtp({ type: 'email' })`.
Pour que l'email contienne un **code** (et non un lien) :

- *Authentication > Sign In / Providers > Email* : activer **Confirm email** ;
  longueur de l'OTP : **6** ;
- *Authentication > Emails > Confirm signup* : utiliser `{{ .Token }}` dans le modèle
  (voir `supabase/templates/confirmation.html`, appliqué automatiquement en local) ;
- *Authentication > URL Configuration* : ajouter `https://<votre-domaine>/reset-password`
  aux **Redirect URLs** (lien de réinitialisation du mot de passe).

En production, configurez un serveur SMTP personnalisé (le service email intégré de
Supabase est fortement limité).

### 3. Connexion par nom

La connexion avec le **nom** passe par l'Edge Function `login-by-name` : le nom est
résolu en email côté serveur (fonction SQL `login_email_for_name`, réservée au
`service_role`), l'authentification est effectuée, et seuls les jetons de session sont
renvoyés. L'email n'est jamais exposé au navigateur et toutes les erreurs renvoient le
même message générique. Si plusieurs comptes portent le même nom, l'utilisateur doit se
connecter avec son email.

```bash
npx supabase functions deploy login-by-name --no-verify-jwt
```

### 4. Premier administrateur

Après l'inscription du premier compte, promouvez-le depuis l'éditeur SQL :

```sql
update public.profiles set role = 'admin', is_validated = true
where email = 'admin@exemple.fr';
```

Les rôles ADU / CDU et la validation des autres comptes se gèrent ensuite depuis
l'interface Administrateur (onglet *Utilisateurs*).

## Modèle de données et sécurité (RLS)

| Table | Contenu |
| --- | --- |
| `regiments`, `companies`, `sections` | Organisation hiérarchique |
| `profiles` | 1-1 avec `auth.users` : nom, email, `role` (`admin`/`adu`/`cdu`/`user`), rattachement, `is_validated` |
| `meals` | Catalogue (nom, description, catégorie, coût unitaire, actif) |
| `menus` | Repas servi pour une date et un service (`petit_dejeuner`, `dejeuner`, `diner`) |
| `reservations` | Réservation d'un militaire pour un menu (statut, présence) |
| `headcount_validations` | Effectif d'une compagnie pour un menu, soumis par l'ADU, approuvé/rejeté par le CDU |

Le profil est créé automatiquement à l'inscription par le trigger `handle_new_user`
(rattachement conservé uniquement s'il est cohérent). Principales règles :

| Ressource | Militaire | ADU | CDU | Admin |
| --- | --- | --- | --- | --- |
| Organisation | lecture (aussi anonyme, pour l'inscription) | lecture | lecture | tout |
| Profils | le sien (nom modifiable) | sa compagnie (lecture) | sa compagnie (lecture) | tout |
| Catalogue / menus | lecture | lecture | lecture | tout |
| Réservations | les siennes ; création/annulation si compte validé et menu à venir | sa compagnie : lecture + pointage de présence | sa compagnie : lecture | tout |
| Validations d'effectifs | — | sa compagnie : soumission (tant que non approuvée) | sa compagnie : approbation / rejet | tout |

Des triggers complètent la RLS au niveau des colonnes : un non-administrateur ne peut
modifier ni son rôle, ni sa validation, ni son rattachement ; l'ADU ne peut modifier que
la présence d'une réservation ; le CDU ne peut modifier que la décision d'une validation.
Les rôles ADU/CDU ne donnent des droits que si le compte est validé.
