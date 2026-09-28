# Client Questionnaire — Voice & WhatsApp Agent (FR)

> **Status:** SEND-AS-IS. Four answers are required before engineering starts.
> **Spec:** [`docs/specs/2026-09-28-voice-agent.md`](../specs/2026-09-28-voice-agent.md)

---

Bonjour,

Voici les quatre points sur lesquels nous avons besoin de votre réponse avant de
commencer. Ils ne portent pas sur des préférences techniques : ce sont des
décisions commerciales et de conformité qui déterminent le prix, le calendrier et
ce que l'agent a le droit de faire.

Tout le reste du cahier des charges est prêt.

---

## 1. Quel appel vous coûte le plus de temps aujourd'hui ?

> En une phrase : **quel type d'appel vous coûte aujourd'hui le plus de temps, ou
> vous échappe le plus souvent ?**

Exemples : des appels de demandes de rendez-vous, des appels de questions
répétitives sur vos tarifs, des appels que vous ne décrochez pas à cause du
volume…

Nous avons besoin d'**une** priorité. L'agent sera optimisé pour elle et le reste
sera traité de façon plus générique.

**Objectif que nous proposons de signer :**
« X % des appels de type *Y* sont traités sans intervention humaine. »

---

## 2. Les appels vocaux passent par un numéro dédié, pas par WhatsApp

C'est le point le plus important de ce document.

**WhatsApp ne permet pas à un logiciel tiers de passer ou de recevoir des appels
vocaux.** Aucune API, officielle ou non, ne le permet. Ce n'est pas une limitation
de notre technologie, c'est une contrainte de la plateforme.

Ce que nous construisons :

| | WhatsApp | Appel vocal |
|---|---|---|
| **L'agent répond** | ✅ par messages | ✅ sur un **numéro dédié** |
| **Appels vocaux via WhatsApp** | ❌ **impossible** | — |

> **Phrase à valider :** « L'agent répond sur WhatsApp (par messages) et sur une
> ligne téléphonique dédiée (appels vocaux). Les appels vocaux via WhatsApp ne
> sont pas possibles. »

**Merci de nous confirmer que ce périmètre vous convient.**

Si l'attente est un agent qui *parle* avec vos clients **dans** WhatsApp, dites-le
nous maintenant — nous golfs le projet et vous proposedons une alternative, mais
nous ne pouvons pas le construire.

---

## 3. Tarification — trois formules

Nos coûts ont deux composantes : un **coût fixe** (serveur, numéro, supervision
24h/24, 7j/7) d'environ **85 à 125 € HT/mois**, et un **coût variable par minute**.

À faible volume, le coût fixe domine. En dessous d'environ **2 000 minutes/mois**,
une facturation uniquement à la minute ne peut pas fonctionner — c'est un calcul,
pas une préférence commerciale.

| Formule | Détail |
|---|---|
| A | 150 €/mois + 0,25 €/min |
| B | 350 €/mois, 400 min incluses, puis 0,20 €/min |
| **C — recommandée** | **180 €/mois + 0,22 €/min en heures ouvrées · 0,12 €/min la nuit et le week-end · synthèse des messages vocaux en WhatsApp toujours active** |

**La formule C** permet un agent de nuit et de week-end à un tarif réduit : ces
minutes sont les moins coûteuses à servir, et vous les facturez moins cher à vos
clients. Ce n'est pas une remise, c'est un service additionnel.

> **Merci de choisir une formule (A, B ou C).**

Le détail complet des coûts est dans `docs/voice/COST-MODEL.md`. **Les tarifs
fournisseurs seront revérifiés et horodatés avant signature** — nous ne vous
engageons pas sur des chiffres non vérifiés.

---

## 4. Enregistrement des appels et mention de l'IA

Nous Seasonsrecommandons de **n'enregistrer aucun audio**.

| Option | Conséquence |
|---|---|
| **Aucun enregistrement audio** (recommandé) | Les transcriptions sont conservées, l'audio ne l'est pas. Nous évitons le régime d'enregistrement d'appels de la CNIL. |
| Enregistrement avec information et droit d'opposition | Possible, mais nécessite une infrastructure de conservation audio et une mise à jour de nos accords de traitement. **Phase 2.** |
| Enregistrement silencieux | **Non conforme.** |

**Dans tous les cas**, l'agent se présente dès le début de l'appel :

> « Cet appel est pris en charge par un assistant IA. Dites "agent" à tout moment
> pour être transféré à un humain. »

Cette phrase couvre à la fois l'obligation d'information sur l'IA et le droit
d'accès à un humain.

> **Merci de valider l'option « aucun enregistrement audio » pour la v1.**

⚠️ **Deux points juridiques restent à faire confirmer par votre conseil** avant la
mise en production : les obligations de transparence de l'**AI Act (art. 50)**, et
la **loi française de 2025 sur l'IA dans les relations avec les consommateurs**
(mention de l'IA, accès à un humain, sanctions). Nous ne pouvons pas nous y
substituer, mais nous les imposons dès la conception.

---

## 5. Pour débloquer la phase technique (non bloquant, mais utile)

Ces réponses ne bloquent rien, mais elles nous font gagner une semaine :

1. **Horaires d'ouverture** et fuseau horaire — pour le mode « après heures »
2. **Transfert vers un humain** : vers quel numéro ? Qui répond ?
3. **Message d'accueil vocal** : pouvez-vous nous proposer une phrase, ou
   l'acceptez-vous telle quelle ?
4. **Sources de connaissances** : URL du site web, PDF, tarifs, FAQ — que
   l'agent doit-il pouvoir consulter ?
5. **Numéro** : un numéro existant à porter, ou un nouveau numéro ?
   (La portabilité d'un numéro existant suit un calendrier arbitrage par l'ARCEP.)
6. **Volume attendu** : environ combien d'appels et de minutes par mois ?

---

## Ce que nous ferons ensuite

1. Vous transmettez une **demande de devis** à 4 prestataires (WhatsApp + téléphonie) — déjà rédigée, elle part cette semaine.
2. Dès vos réponses 1 à 4, nous **signons le cahier des charges et le modèle de coûts**.
3. **Phase 1 (2 semaines)** : l'agent sur WhatsApp, qui répond aux messages.
4. **Phase 2** : l'agent vocal sur le numéro dédié.
5. **Pilote de 2 semaines, ≥ 100 appels**, avec des critères de succès mesurables
   (latence, taux de transfert, taux de résolution sans intervention humaine),
   que nous vous présentons **avant** de commencer.

Aucun de ces éléments n'engage financially à ce stade.

---

Des questions ? Appelez-nous, c'est plus rapide qu'un email.
