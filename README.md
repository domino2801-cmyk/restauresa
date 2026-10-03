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
| **Accès indisponible** (`/pending`) | Page de vérification si l'activation n'est pas effective ou a été retirée. |

Les comptes sont **activés automatiquement après confirmation de l'email par OTP**,
sans intervention administrateur. La migration
`20261002020000_auto_validate_confirmed_accounts.sql` active également les comptes
existants non validés dont l'email est confirmé. Un email non confirmé ne donne
pas d'accès. Le rôle initial reste **Militaire** : les rôles ADU, CDU et administrateur
restent attribués uniquement par un administrateur. Les mises à jour ordinaires
du profil ou les reconnexions ne réactivent pas un compte désactivé après cette migration.
Appliquer cette migration Supabase avant publication des textes de l'interface.

### Interfaces par rôle (table `profiles`)

| Rôle | Accueil | Contenu |
| --- | --- | --- |
| **Administrateur** (`admin`) | `/admin` | Vue d'ensemble analytique (KPIs, réservations par jour, taux par compagnie, coût estimé) ; gestion des **utilisateurs** (validation, rôle, régiment/compagnie/section, suppression du compte via la fonction `admin_delete_user`) ; gestion de l'**organisation** ; **catalogue des repas** ; **menus de la semaine limités au déjeuner**. |
| **ADU** – Adjudant de compagnie (`adu`) | `/adu` | Qui a réservé dans sa compagnie (par date et service), **triable par section / nom / statut**, filtre réservés / non réservés, **réservation / annulation pour tous les personnels de sa CIE jusqu'à J-2 à 14 h**, synthèse par section, pointage de présence, **export CSV** et **validation de l'effectif** transmis aux cuisines. |
| **CDU** – Commandant de compagnie (`cdu`) | `/cdu` | KPIs (taux de réservation, **taux de présence**, coût estimé, effectifs à approuver), **bilan hebdomadaire par jour** (effectif prévu, passé, absences pointées, pointages manquants, perte financière estimée), graphiques par jour et par section, **revue des effectifs** (approbation / rejet motivé). |
| **Restauration** (`restauration`) | `/restauration` | Vue globale de toutes les compagnies, par jour et service : réservations actives, passages, pourcentage de passage et fréquentation par tranches de 15 minutes (heure de Paris). Aucun nom, identifiant ou détail individuel n'est renvoyé. Accessible aussi à l'administrateur. |
| **Militaire** (`user`) | `/reservations` | Réservation / annulation des repas du lundi au vendredi, avec une case **« Week-end »** pour afficher samedi et dimanche. Masquer le week-end conserve les réservations existantes et leur inclusion dans le total hebdomadaire. Accessible aussi aux autres rôles via « Mes repas ». |

Le bilan CDU porte uniquement sur sa compagnie et compte un passage par repas réservé.
La perte financière estimée additionne le prix des repas réservés dont l'absence a été
explicitement pointée. Les annulations, les jours futurs et les pointages manquants sont
exclus. Les absences sans prix sont signalées comme une estimation partielle ; les
chiffres du jour en cours (heure de Paris) restent provisoires.
La vue par section classe les sections par nombre de repas non consommés décroissant,
avec les consommations, pointages manquants et pertes estimées. Le taux de
non-consommation se calcule sur les seuls repas pointés (présences + absences) ;
sans pointage, il est indiqué comme non disponible. Le rattachement est celui de la
section actuelle du personnel ; les personnels non affectés figurent sous « Sans section ».

La fonction Restauration utilise uniquement la RPC agrégée `get_catering_overview`.
Ce rôle n'élargit pas l'accès aux profils, réservations individuelles ou validations
d'effectifs d'autres compagnies. Il est attribué par l'administrateur depuis les utilisateurs.
Le pourcentage est `présences / réservations actives × 100` ; sans réservation, il est
non disponible. Les passages anciens sans horodatage restent dans le pourcentage mais
pas dans les tranches horaires. Les scans QR existants sont repris avec leur heure réelle ;
les nouveaux pointages ADU sont horodatés à la saisie, qui peut différer de l'arrivée réelle.
Un pointage saisi un autre jour que le repas est exclu des tranches et signalé.
Les annulations sont exclues et aucun pointage n'est clôturé automatiquement.
Le graphique et les chiffres par tranche sont limités au petit-déjeuner de **6 h 30 à
7 h 30**, au déjeuner de **11 h 30 à 13 h 30** et au dîner de **17 h 45 à 19 h**.
Chaque tranche inclut son début et exclut sa fin : le déjeuner comporte huit
tranches, la dernière de 13 h 15 à 13 h 30. Les passages hors horaires restent
dans les totaux et le pourcentage, mais sont exclus du graphique et signalés.
Ces horaires ne restreignent pas le pointage QR ou ADU.

Avant de déployer cette interface, appliquer dans l'ordre les migrations
`20261003000000_catering_role.sql` (nouvelle valeur d'enum, transaction séparée) puis
`20261003010000_catering_overview.sql` (horodatage et RPC). Elles sont testées avec
PGlite sans accès aux données de production. GitHub Pages ne les applique pas.
Appliquer ensuite `20261003020000_catering_quarter_hours.sql` avant de publier
les tranches de 15 minutes. La RPC conserve `half_hours` pour les anciens clients
et ajoute `quarter_hours` ; le nouveau frontend signale explicitement une migration
manquante plutôt que d'afficher des chiffres horaires incorrects.

Les **DEJ du lundi au jeudi** sont précochés avant la
clôture, sauf si un choix a déjà été enregistré (notamment une annulation).
Ces présélections et toutes les modifications de cases restent en brouillon jusqu'au
clic sur **« Confirmer mes réservations »**. Les choix sont enregistrés ensemble ;
un DEJ décoché explicitement reste décoché après rechargement. Le total hebdomadaire
ne compte que les réservations enregistrées, pas les présélections.
Après confirmation réussie, le rappel « Confirmez vos repas avant le… » est
remplacé par **« Réservations effectuées »**. Ce statut reste visible après
rechargement lorsque les choix affichés sont enregistrés. Une modification non
confirmée réaffiche le rappel ; après clôture, l'avertissement de fermeture reste visible.

La grille « Mes repas » s'adapte aux petits écrans sans défilement horizontal :
les colonnes PDJ / DEJ / DIN restent visibles, les dates peuvent revenir à la ligne
et le bouton de confirmation occupe la largeur disponible sur mobile.

La navigation administrateur propose aussi les onglets **ADU** et **CDU**, comme
**Restauration**. Un sélecteur permet de choisir une compagnie de n'importe quel
régiment, sans modifier le profil administrateur. Changer de compagnie réinitialise
la vue pour éviter de conserver les données ou actions de la compagnie précédente.
L'onglet ADU permet les corrections de réservation avec les droits administrateur
existants, même après clôture, ainsi que le pointage et la transmission des effectifs.
L'onglet CDU permet de consulter le bilan et d'approuver ou rejeter les effectifs.
Les comptes ADU et CDU conservent leur compagnie et leurs limites habituelles ;
aucun droit supplémentaire n'est accordé aux autres rôles.

Les réservations ne dépendent plus de la publication des plats : chaque date
dispose des services **PDJ / DEJ / DIN**, même avec un plat non renseigné.
L'administration des menus affiche uniquement le déjeuner pour chaque jour.
Les plats PDJ/DIN déjà renseignés et les réservations des trois services restent
conservés ; aucun menu ni aucune réservation n'est supprimé par ce changement.
La migration `20261002030000_reservations_without_published_meals.sql` rend
`menus.meal_id` facultatif et ajoute `ensure_meal_services`, réservé aux comptes
activés, pour créer les services manquants de la période consultée (31 jours
maximum par appel, sans modifier les plats existants). Les cases restent soumises
aux échéances client et ADU. Publier, remplacer ou retirer un plat conserve
l'identifiant du service et toutes ses réservations. Un plat absent n'a pas de
coût connu et n'entre donc pas dans le coût estimé tant qu'il n'est pas renseigné.
Appliquer la migration avant de publier le frontend correspondant.

Chaque semaine de repas (lundi à dimanche) est clôturée **le jeudi précédent à
14 h, heure de Paris**, changements d'heure été/hiver inclus. À partir de cet
instant, le client ne peut plus réserver, modifier ou annuler ; les brouillons
non confirmés ne sont pas enregistrés. La consultation reste possible, y compris
le week-end. L'interface affiche l'échéance et se verrouille même si elle reste ouverte.
La migration `20261002000000_reservation_deadline.sql` applique aussi la règle
aux insertions, mises à jour et upserts Supabase. Elle doit être appliquée avec
`npx supabase db push` avant la publication du frontend. Les droits de correction
de l'administrateur et de pointage de présence de l'ADU restent inchangés.

L'ADU validé peut réserver, réactiver ou annuler les repas de **tous les personnels
de sa CIE**, lui-même inclus, depuis la colonne « Réservation » de son tableau.
Chaque changement est enregistré immédiatement et actualise les statistiques.
Si les chiffres diffèrent d'un effectif déjà transmis, un avertissement demande
de le mettre à jour, ou de le faire revoir par le CDU s'il a déjà été approuvé.
La limite est **J-2 à 14 h, heure de Paris, pour chaque date de repas** (jours
calendaires, week-end inclus : samedi à 14 h pour les repas du lundi).
Le pointage de présence reste disponible après cette limite. La migration
`20261002010000_adu_reservation_deadline.sql` ajoute la fonction serveur
`set_company_reservation` : contrôle du rôle ADU, de la validation du compte,
de l'appartenance du personnel à sa CIE et de l'échéance. Elle doit être appliquée
avant publication de cette interface. Les droits du client et du CDU ne sont pas élargis.

### Passage par QR code

L'administration propose **QR établissement** : un QR permanent commun à
RestauResa, téléchargeable et à afficher au mess. Chaque compte activé dispose
du lecteur **Scanner mon passage** (caméra arrière, autorisation requise, HTTPS).
Le client choisit PDJ / DEJ / DIN puis scanne le code. Le serveur ne pointe que
sa propre réservation `reserved` du jour en **Europe/Paris**, et refuse un code
incorrect, un repas non réservé/annulé ou un passage déjà validé. Les présélections
non confirmées ne suffisent pas. Le pointage alimente les statistiques et le
tableau ADU via `reservations.attended`. Le pointage manuel ADU reste disponible.
La caméra est arrêtée après le scan, à la sortie de page ou en arrière-plan.
Le code permanent peut être photographié et partagé : ce dispositif ne garantit
pas la présence physique. Aucun horaire de service supplémentaire n'est imposé.
Appliquer `20261002040000_qr_attendance.sql` avant publication du frontend.
Le bouton administrateur **Générer un nouveau QR code** demande confirmation,
remplace le code côté serveur et invalide immédiatement l'ancien. Les réservations
et passages déjà enregistrés sont conservés. Télécharger et remplacer le QR affiché
au mess après renouvellement. Seul un administrateur activé peut le renouveler.
Appliquer aussi `20261002050000_rotate_establishment_qr.sql` pour ce bouton.

### PWA

- Manifest + service worker générés par `vite-plugin-pwa` (Workbox) : application
  **installable** sur smartphone, ressources pré-cachées, mise à jour automatique.
- Les lectures de l'API Supabase sont mises en cache (stratégie *network first*) pour
  une consultation hors-ligne des dernières données. Ce cache est purgé à la
  déconnexion (manuelle ou expiration de session) afin de ne pas exposer ces données
  à un autre utilisateur du même appareil.
- Emblème bleu sur fond blanc fourni pour l'application : `public/logo.png`.
  Les favicons, icônes Android/PWA (64, 192 et 512 px), icône adaptable
  (*maskable*) et icône Apple (180 px) sont générés depuis cette image avec
  `npm run generate-pwa-assets`. Le même emblème apparaît dans l'en-tête et
  sur les écrans de connexion.

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
    ├── functions/send-test-email/ # Edge Function : email de test via Resend
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

Les tests de clôture exécutent aussi la migration dans un PostgreSQL en mémoire
(PGlite, dépendance de développement), sans accès au projet Supabase de production.

## Déploiement en production (GitHub Pages + Supabase)

L'application est publiée sur GitHub Pages et utilise un projet Supabase hébergé pour la
base de données et l'authentification. Suivez les étapes dans l'ordre :

1. **Créer le projet Supabase.** Dans le tableau de bord Supabase, créez un projet et
   relevez son URL, sa clé publique `anon`/`publishable` et sa référence de projet
   (*Project Reference*). N'utilisez jamais la clé `service_role` dans l'application.
2. **Appliquer le schéma.** À la racine du dépôt, liez le CLI Supabase au projet puis
   appliquez les migrations :
   ```bash
   npx supabase link --project-ref VOTRE_PROJECT_REF
   npx supabase db push
   ```
3. **Configurer les emails et les URL d'authentification** dans le tableau de bord
   Supabase. Activez la confirmation par email et l'OTP à 6 chiffres, configurez le modèle
   *Confirm signup* avec `{{ .Token }}`, et utilisez
   `https://domino2801-cmyk.github.io/restauresa/` comme *Site URL*. Ajoutez
   `https://domino2801-cmyk.github.io/restauresa/reset-password` aux *Redirect URLs*.
   Les liens de récupération demandés depuis `localhost` renvoient aussi vers le site
   publié, afin qu'ils restent utilisables après l'arrêt du serveur local.
   L'application détecte l'événement Supabase `PASSWORD_RECOVERY` et ouvre le
   formulaire de nouveau mot de passe même si le lien revient sur l'accueil.
   Si un lien revient encore sur `localhost`, vérifiez aussi le modèle
   *Reset password* : il doit utiliser `{{ .ConfirmationURL }}`, et non une URL locale
   écrite en dur. Ces réglages du projet hébergé ne sont pas modifiés par GitHub Pages.
   Configurez également un serveur SMTP personnalisé pour la production. Les détails
   figurent dans [Configuration Supabase](#configuration-supabase).
4. **Déployer l'Edge Function** de connexion par nom :
   ```bash
   npx supabase functions deploy login-by-name --no-verify-jwt
   ```
   Pour l'envoi d'emails via Resend, déployez aussi `send-test-email` (voir
   [Emails avec Resend](#5-emails-avec-resend)).
5. **Renseigner les variables de build** dans GitHub : ouvrez *Settings > Secrets and
   variables > Actions > Variables* et ajoutez `VITE_SUPABASE_URL` (URL du projet) et
   `VITE_SUPABASE_ANON_KEY` (clé publique `anon`/`publishable`). Ces variables sont
   intégrées au build ; n'y mettez aucune clé secrète.
6. **Activer GitHub Pages.** Dans *Settings > Pages*, sélectionnez **GitHub Actions**
   comme source de déploiement.
7. **Lancer la publication.** Poussez vos changements sur `main` ou lancez manuellement
   le workflow **Deploy to GitHub Pages** dans l'onglet *Actions*. Vérifiez que les jobs de
   compilation et de déploiement réussissent. Le site sera disponible à
   `https://domino2801-cmyk.github.io/restauresa/`.
8. **Créer le premier administrateur.** Inscrivez un compte, confirmez son email, puis
   promouvez-le avec la requête SQL indiquée dans [Premier administrateur](#4-premier-administrateur).
9. **Vérifier l'application publiée.** Testez la connexion, l'inscription et son code OTP,
   la réinitialisation du mot de passe, les accès des différents rôles ainsi que
   l'installation de la PWA sur un téléphone.

Le workflow `.github/workflows/deploy-pages.yml` configure le sous-chemin du dépôt, le
routage React, la PWA et un repli `404.html` pour les URL internes de l'application.

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

### 5. Emails avec Resend

L'intégration [Resend](https://resend.com) se fait à deux niveaux :

**a) Fonction technique d'email de test.** L'onglet et la page `/admin/email`
ont été retirés de l'application. L'Edge Function `send-test-email` reste disponible
pour les vérifications techniques ; elle vérifie que l'appelant est
un administrateur validé puis envoie l'email via l'API Resend. La clé Resend reste côté
serveur (secret de la fonction) et n'est jamais incluse dans le build.

| Secret | Obligatoire | Description |
| --- | --- | --- |
| `RESEND_API_KEY` | oui | Clé API Resend (*API Keys* dans le tableau de bord Resend). |
| `RESEND_FROM` | non | Expéditeur, ex. `RestauResa <noreply@votre-domaine.fr>` (domaine vérifié dans Resend). Défaut : `RestauResa <onboarding@resend.dev>`, qui ne peut écrire qu'à l'adresse du compte Resend. |
| `RESEND_TEST_RECIPIENT` | non | Destinataire par défaut si aucun destinataire n'est fourni. Défaut : l'email de l'administrateur connecté. |

En production :

```bash
npx supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="RestauResa <noreply@votre-domaine.fr>" RESEND_TEST_RECIPIENT=vous@exemple.fr
npx supabase functions deploy send-test-email
```

En local :

```bash
cp supabase/functions/.env.example supabase/functions/.env   # renseigner les valeurs (fichier ignoré par git)
npx supabase start
npx supabase functions serve --env-file supabase/functions/.env
```

La fonction peut être appelée avec un jeton d'administrateur validé et un corps
JSON `{ "to": "vous@exemple.fr" }` (ou `{}` pour le destinataire par défaut).

**b) Rappel automatique chaque mercredi.** Le workflow GitHub Actions déclenche l'Edge
Function `weekly-reservation-reminder` à 09 h, heure de Paris. Il envoie un email
individuel aux comptes dont l'adresse est confirmée et le profil validé, avec le rappel
de réserver les repas de la semaine suivante avant le jeudi à 14 h et un lien direct
vers la page de connexion.
Le lancement manuel de ce workflow envoie seulement un email de test au compte Yopmail
`restauresa.test.20261002@yopmail.com`, et n'est donc pas destiné à relancer la campagne.

Configurez les secrets côté Supabase (la clé Resend et un expéditeur issu d'un domaine
vérifié sont obligatoires) :

```bash
npx supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="RestauResa <noreply@votre-domaine.fr>" WEEKLY_REMINDER_SECRET="secret-long-aleatoire"
npx supabase functions deploy weekly-reservation-reminder
```

Dans **GitHub > Settings > Secrets and variables > Actions**, ajoutez le secret
`WEEKLY_REMINDER_SECRET` avec la même valeur que côté Supabase. Le workflow réutilise
les variables de dépôt `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` déjà nécessaires
au déploiement du site et tient compte des changements d'heure en Europe/Paris.
`RESEND_FROM` doit être un expéditeur vérifié dans Resend ; l'adresse de démonstration
`onboarding@resend.dev` ne convient pas pour envoyer à tous les utilisateurs.

**c) Emails d'authentification (code OTP, réinitialisation) via le SMTP Resend.** Dans
*Authentication > Emails > SMTP Settings* du projet Supabase, activez le SMTP
personnalisé avec : hôte `smtp.resend.com`, port `465`, utilisateur `resend`, mot de passe
= clé API Resend, et un expéditeur sur un domaine vérifié. En local, la section
`[auth.email.smtp]` de `supabase/config.toml` peut être décommentée (elle lit
`RESEND_API_KEY` depuis l'environnement).

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

| Ressource | Militaire | ADU | CDU | Restauration | Admin |
| --- | --- | --- | --- | --- | --- |
| Organisation | lecture (aussi anonyme, pour l'inscription) | lecture | lecture | lecture | tout |
| Profils | le sien (nom modifiable) | sa compagnie (lecture) | sa compagnie (lecture) | le sien | tout |
| Catalogue / menus | lecture | lecture | lecture | lecture | tout |
| Réservations | les siennes ; création/annulation si compte validé et menu à venir | sa compagnie : lecture + pointage de présence | sa compagnie : lecture | les siennes uniquement | tout |
| Validations d'effectifs | — | sa compagnie : soumission (tant que non approuvée) | sa compagnie : approbation / rejet | — | tout |
| Statistiques globales restauration (RPC) | — | — | — | lecture agrégée si validé | lecture agrégée si validé |

Des triggers complètent la RLS au niveau des colonnes : un non-administrateur ne peut
modifier ni son rôle, ni sa validation, ni son rattachement ; l'ADU ne peut modifier que
la présence d'une réservation ; le CDU ne peut modifier que la décision d'une validation.
Les rôles ADU/CDU ne donnent des droits que si le compte est validé.
