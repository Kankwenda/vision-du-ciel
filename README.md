# Vision du Ciel

Registre d'identité en React Native, interface sombre tech.

## Fonctionnalités

- **Enregistrer une personne** : nom complet, type de pièce d'identité
  (carte d'identité, passeport, permis de conduire, carte d'électeur, autre),
  numéro de pièce, téléphone, photo (appareil photo ou galerie).
  Chaque personne reçoit un code unique (P0001, P0002, …).
- **Identifier une personne** : par code ou par nom, avec affichage de la
  fiche et de la photo.
- **Identifier par empreinte** : le capteur du téléphone confirme le
  propriétaire du téléphone et affiche son profil (à désigner dans sa fiche
  via « Définir comme propriétaire du téléphone »).
- **Fiche détaillée** : photo, identité, suppression avec confirmation.
- **Stockage local** : les données restent sur le téléphone (AsyncStorage),
  aucune donnée n'est envoyée ailleurs.

## Limite technique honnête

Android ne laisse aucune application extraire ni comparer des empreintes :
le capteur confirme seulement que le doigt posé est celui du propriétaire
du téléphone. Il est donc impossible, sur téléphone, d'identifier plusieurs
personnes différentes par leur empreinte. L'identification des autres
personnes se fait par code ou par nom. Une identification biométrique
multi-personnes exigerait un lecteur d'empreinte USB dédié avec son propre
logiciel, pas le capteur du téléphone.

## Compiler

Le workflow GitHub Actions (`.github/workflows/build-apk.yml`) compile
l'APK debug à chaque push sur `main` (ou manuellement via
`workflow_dispatch`). L'artefact `VisionDuCiel-debug-apk` contient
`app-debug.apk`, installable sur Android.

En local (nécessite Node 20+, JDK 17 et le SDK Android) :

```sh
npm install
npm run android
```
