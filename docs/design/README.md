# Lisette design reference: working design v6

> **Status: working design, not approved identity.** This folder holds the v6 redesign of 2026-10-21 as a visual
> reference for agents. It does not change any brand decision. Approved values (palette, fonts, logo, taglines,
> central promise, tone) stay in [`brand/`](../../brand/README.md), led by `brand/brand.yaml`. Functional behaviour
> stays in [`requirements.md`](../product/requirements.md) and [`screens.md`](../product/screens.md). Where this
> folder and those documents disagree, follow the documents.

## How agents use these files
- Use the screens, boards and assets as a **visual reference for layout and style**: hierarchy, spacing, component
  shapes, how a state looks, how Paper and Seara screens feel.
- Do **not** take final copy from them. The text in the PNGs is draft Romanian with fictional people, publishers and
  sample data (for example "Ioana Mareș", "Editura Malul de Argint"). Reviewed interface copy is still pending.
- Do **not** take functionality from them. A control drawn in a screen is not a confirmed feature, and a missing
  control is not a removed one. Check `docs/product/requirements.md` and `docs/product/screens.md`.
- Do not treat the extra colours in `tokens.json` as approved palette entries. Do not adopt the remaining shadows or
  the dark-theme scope until the points under "Proposed, not decided" are decided (the mascot is approved, see a).
- A screen showing a lock, a fingerprint prompt or an upload record designs a protection state. It is not evidence
  that the protection exists, and device or upload verification is never proof of authorship.

## Source and regeneration
| What | Where |
|---|---|
| Generator (source of truth) | `C:\Users\Ana Maria\Documents\Lisette-figcraft\generator_v6\`, built with `python v3_build.py` |
| Built file | `Lisette-figcraft\out\Lisette-redesign-v6.figcraft` (13 pages; screens on pages 10–17) |
| Page boards | `Lisette-figcraft\out\share\redesign-v6\*.png` |
| Renderer | FigCraft 0.7.0 `figcraft-cli.exe`, the same engine as the `figcraft` MCP server |

Everything is generated outside this repository. To refresh this folder:
1. If the generator changed, rebuild in `Lisette-figcraft` with `python v3_build.py`. Page and node IDs change on
   every rebuild, so match frames by name, never by a stored ID. When using the MCP server, force-close and reopen the
   file first; it caches open documents.
2. Screens: for each top-level frame on pages 10–17, run
   `figcraft-cli export <file> -o <png> --format png --scale <2 for phone, 1 for tablet and web> --node <id>`.
   Exports are transparent, so composite each one onto its screen colour: Paper `#F6EFE3`, or Night burgundy
   `#3A121C` for Seara frames. The MCP server may only write inside `Lisette-figcraft`; the CLI can write here.
3. Boards: copy the 13 PNGs from `out/share/redesign-v6/`.
4. Illustrations: from `generator_v6`, call `rd_art.write_svgs("<repo>/docs/design/assets/illustrations", rd_art.ART)`.
   It clears and rewrites the folder's SVGs. Run Python with `-B` so nothing is written to the generator's `__pycache__`.
5. Icons: wrap each body in `lib.ICONS` and `rd_comps.EXTRA` in a 24×24 SVG with `fill="none"`,
   `stroke="currentColor"`, `stroke-width="1.75"` and round caps and joins.
6. Tokens: read `rd_ds.COLORS`, `rd_ds.NUM`, `rd_ds.TYPE` and `rd_ds.effect_styles()`, and check them against
   FigCraft's `variable.export`.

The helper scripts used for the 2026-10-21 export were kept outside the repository.

**The boards may lag the file.** The board PNGs were written at 12:34 on 2026-10-21 and the `.figcraft` file was saved
at 18:28. The PNGs in `screens/` come from the file and are the more current view.

## Screens
132 top-level frames: 116 phone (360 px wide, exported at 2×), 3 tablet (1280×800, 1×) and 13 web
(1440×900, 1×). **State** is "main" for each board's primary-path, tablet and web rows, and "state" for its
states-and-variants row, with three exceptions. *S-29 Detaliu trimitere: Selectat de editură* sits in page 13's
main row but is a state of S-29, whose main frame is on page 12. *S-73 Editor de eveniment* and
*S-75 Descoperire: creator* sit in page 16's states row but are the base screens of their IDs.
The key screens S-20, S-50, S-53, S-57 and S-60 are drawn by `rd_screens` and replace the earlier D versions, which
the build deletes.

| ID | State | Format | PNG | FigCraft frame |
|---|---|---|---|---|
| S-01 | main | phone 360×800 | [s-01-limba-ecran-de-start.png](screens/s-01-limba-ecran-de-start.png) | S-01 Limbă (ecran de start) |
| S-01 | main | phone 360×800 | [s-01-bun-venit-dupa-alegerea-limbii.png](screens/s-01-bun-venit-dupa-alegerea-limbii.png) | S-01 Bun venit (după alegerea limbii) |
| S-02 | main | phone 360×800 | [s-02-creeaza-cont.png](screens/s-02-creeaza-cont.png) | S-02 Creează cont |
| S-02 | state | phone 360×800 | [s-02-intra-in-cont-varianta.png](screens/s-02-intra-in-cont-varianta.png) | S-02 Intră în cont (variantă) |
| S-02 | state | phone 360×800 | [s-02-creeaza-cont-eroare-de-validare.png](screens/s-02-creeaza-cont-eroare-de-validare.png) | S-02 Creează cont: eroare de validare |
| S-02 | state | phone 360×800 | [s-02-creeaza-cont-se-incarca-evantaiul.png](screens/s-02-creeaza-cont-se-incarca-evantaiul.png) | S-02 Creează cont: se încarcă (evantaiul) |
| S-02 | state | phone 360×800 | [s-02-creeaza-cont-fara-conexiune.png](screens/s-02-creeaza-cont-fara-conexiune.png) | S-02 Creează cont: fără conexiune |
| S-03 | main | phone 360×800 | [s-03-verifica-email.png](screens/s-03-verifica-email.png) | S-03 Verifică email |
| S-04 | state | phone 360×800 | [s-04-recuperare-parola-cerere.png](screens/s-04-recuperare-parola-cerere.png) | S-04 Recuperare parolă: cerere |
| S-04 | state | phone 360×800 | [s-04-recuperare-parola-parola-noua.png](screens/s-04-recuperare-parola-parola-noua.png) | S-04 Recuperare parolă: parolă nouă |
| S-05 | main | phone 360×800 | [s-05-rolul-tau-activare-scriitor.png](screens/s-05-rolul-tau-activare-scriitor.png) | S-05 Rolul tău (activare scriitor) |
| S-05 | state | phone 360×800 | [s-05-cerere-de-cont-de-editura.png](screens/s-05-cerere-de-cont-de-editura.png) | S-05 Cerere de cont de editură |
| S-06 | main | phone 360×1240 | [s-06-setari-ecran-derulabil.png](screens/s-06-setari-ecran-derulabil.png) | S-06 Setări (ecran derulabil) |
| S-06 | state | phone 360×800 | [s-06-tipare-de-citire-consimtamant-in-setari.png](screens/s-06-tipare-de-citire-consimtamant-in-setari.png) | S-06 Tipare de citire: consimțământ în Setări |
| S-06 | state | phone 360×800 | [s-06-stergerea-contului-confirmare.png](screens/s-06-stergerea-contului-confirmare.png) | S-06 Ștergerea contului: confirmare |
| S-07 | main | phone 360×800 | [s-07-conturi-blocate.png](screens/s-07-conturi-blocate.png) | S-07 Conturi blocate |
| S-07 | state | phone 360×800 | [s-07-conturi-blocate-gol.png](screens/s-07-conturi-blocate-gol.png) | S-07 Conturi blocate: gol |
| S-10 | main | phone 360×800 | [s-10-profil-de-cititor.png](screens/s-10-profil-de-cititor.png) | S-10 Profil de cititor |
| S-10 | state | phone 360×800 | [s-10-profil-de-cititor-biblioteca-privata.png](screens/s-10-profil-de-cititor-biblioteca-privata.png) | S-10 Profil de cititor: bibliotecă privată |
| S-11 | main | phone 360×1500 | [s-11-profil-de-autor-ecran-derulabil.png](screens/s-11-profil-de-autor-ecran-derulabil.png) | S-11 Profil de autor (ecran derulabil) |
| S-11 | state | phone 360×800 | [s-11-profil-de-autor-portofoliu-gol.png](screens/s-11-profil-de-autor-portofoliu-gol.png) | S-11 Profil de autor: portofoliu gol |
| S-12 | main | phone 360×800 | [s-12-editor-de-portofoliu.png](screens/s-12-editor-de-portofoliu.png) | S-12 Editor de portofoliu |
| S-12 | state | phone 360×800 | [s-12-editor-de-portofoliu-eroare.png](screens/s-12-editor-de-portofoliu-eroare.png) | S-12 Editor de portofoliu: eroare |
| S-13 | main | phone 360×1300 | [s-13-profil-de-editura-ecran-derulabil.png](screens/s-13-profil-de-editura-ecran-derulabil.png) | S-13 Profil de editură (ecran derulabil) |
| S-13 | state | phone 360×800 | [s-13-profil-de-editura-nu-primeste-acum.png](screens/s-13-profil-de-editura-nu-primeste-acum.png) | S-13 Profil de editură: nu primește acum |
| S-13 | state | phone 360×800 | [s-13-profil-de-editura-cont-blocat.png](screens/s-13-profil-de-editura-cont-blocat.png) | S-13 Profil de editură: cont blocat |
| S-14 | main | web 1440×900 | [s-14-setarile-editurii-web.png](screens/s-14-setarile-editurii-web.png) | W S-14 Setările editurii (web) |
| S-15 | main | phone 360×800 | [s-15-cerere-de-asociere-autor.png](screens/s-15-cerere-de-asociere-autor.png) | S-15 Cerere de asociere (autor) |
| S-15 | state | phone 360×800 | [s-15-cerere-de-asociere-refuz.png](screens/s-15-cerere-de-asociere-refuz.png) | S-15 Cerere de asociere: refuz |
| S-20 / S-28 | main | phone 360×1780 | [s-20-s-28-manuscrise-si-trimiteri.png](screens/s-20-s-28-manuscrise-si-trimiteri.png) | S-20 / S-28 Manuscrise și trimiteri |
| S-20 | state | phone 360×800 | [s-20-manuscrisele-mele-gol.png](screens/s-20-manuscrisele-mele-gol.png) | S-20 Manuscrisele mele: gol |
| S-20 | state | phone 360×800 | [s-20-manuscrise-deblocare-cu-amprenta.png](screens/s-20-manuscrise-deblocare-cu-amprenta.png) | S-20 Manuscrise: deblocare cu amprentă |
| S-20 | main | tablet 1280×800 | [s-20-manuscrise-lista-si-detaliu-tableta.png](screens/s-20-manuscrise-lista-si-detaliu-tableta.png) | T S-20 Manuscrise: listă și detaliu (tabletă) |
| S-20 | main | web 1440×900 | [s-20-manuscrise-lista-si-detaliu-web.png](screens/s-20-manuscrise-lista-si-detaliu-web.png) | W S-20 Manuscrise: listă și detaliu (web) |
| S-21 | main | phone 360×960 | [s-21-detaliu-manuscris-ecran-derulabil.png](screens/s-21-detaliu-manuscris-ecran-derulabil.png) | S-21 Detaliu manuscris (ecran derulabil) |
| S-22 | main | phone 360×800 | [s-22-incarcare-versiune.png](screens/s-22-incarcare-versiune.png) | S-22 Încărcare versiune |
| S-22 | state | phone 360×800 | [s-22-incarcare-pdf-invalid.png](screens/s-22-incarcare-pdf-invalid.png) | S-22 Încărcare: PDF invalid |
| S-22 | state | phone 360×800 | [s-22-incarcare-neconfirmata.png](screens/s-22-incarcare-neconfirmata.png) | S-22 Încărcare: neconfirmată |
| S-22 | state | phone 360×800 | [s-22-incarcare-in-curs-evantaiul.png](screens/s-22-incarcare-in-curs-evantaiul.png) | S-22 Încărcare: în curs (evantaiul) |
| S-23 | main | phone 360×800 | [s-23-previzualizare-pdf.png](screens/s-23-previzualizare-pdf.png) | S-23 Previzualizare PDF |
| S-24 | main | phone 360×800 | [s-24-catalog-de-edituri-pasul-2.png](screens/s-24-catalog-de-edituri-pasul-2.png) | S-24 Catalog de edituri, pasul 2 |
| S-24 | state | phone 360×800 | [s-24-eligibilitate-duplicat-si-editura-inchisa.png](screens/s-24-eligibilitate-duplicat-si-editura-inchisa.png) | S-24 Eligibilitate: duplicat și editură închisă |
| S-25 | main | phone 360×800 | [s-25-compunere-pasul-1-versiunea.png](screens/s-25-compunere-pasul-1-versiunea.png) | S-25 Compunere, pasul 1: versiunea |
| S-25 | main | phone 360×800 | [s-25-compunere-pasul-3-materialele.png](screens/s-25-compunere-pasul-3-materialele.png) | S-25 Compunere, pasul 3: materialele |
| S-26 | main | phone 360×800 | [s-26-verificare-si-consimtamant-pasul-4.png](screens/s-26-verificare-si-consimtamant-pasul-4.png) | S-26 Verificare și consimțământ, pasul 4 |
| S-26 | state | phone 360×800 | [s-26-verificare-buton-blocat.png](screens/s-26-verificare-buton-blocat.png) | S-26 Verificare: buton blocat |
| S-27 | main | phone 360×800 | [s-27-rezultatul-trimiterii.png](screens/s-27-rezultatul-trimiterii.png) | S-27 Rezultatul trimiterii |
| S-27 | state | phone 360×800 | [s-27-rezultatul-prima-trimitere.png](screens/s-27-rezultatul-prima-trimitere.png) | S-27 Rezultatul: prima trimitere |
| S-28 | main | phone 360×800 | [s-28-trimiterile-mele.png](screens/s-28-trimiterile-mele.png) | S-28 Trimiterile mele |
| S-28 | main | web 1440×900 | [s-28-trimiterile-mele-web.png](screens/s-28-trimiterile-mele-web.png) | W S-28 Trimiterile mele (web) |
| S-29 | main | phone 360×800 | [s-29-detaliu-trimitere-in-evaluare.png](screens/s-29-detaliu-trimitere-in-evaluare.png) | S-29 Detaliu trimitere: În evaluare |
| S-29 | state | phone 360×800 | [s-29-detaliu-trimitere-selectat-de-editura.png](screens/s-29-detaliu-trimitere-selectat-de-editura.png) | S-29 Detaliu trimitere: Selectat de editură |
| S-29 | state | phone 360×800 | [s-29-detaliu-trimitere-in-asteptare.png](screens/s-29-detaliu-trimitere-in-asteptare.png) | S-29 Detaliu trimitere: În așteptare |
| S-29 | state | phone 360×800 | [s-29-retragere-confirmare.png](screens/s-29-retragere-confirmare.png) | S-29 Retragere: confirmare |
| S-30 | main | phone 360×1000 | [s-30-cerere-de-distribuire.png](screens/s-30-cerere-de-distribuire.png) | S-30 Cerere de distribuire |
| S-30 | state | phone 360×800 | [s-30-cerere-stare-aprobari.png](screens/s-30-cerere-stare-aprobari.png) | S-30 Cerere: stare aprobări |
| S-30 | state | phone 360×900 | [s-30-cerere-text-modificat-aprobare-reluata.png](screens/s-30-cerere-text-modificat-aprobare-reluata.png) | S-30 Cerere: text modificat, aprobare reluată |
| S-40 | main | phone 360×800 | [s-40-inbox-de-trimiteri.png](screens/s-40-inbox-de-trimiteri.png) | S-40 Inbox de trimiteri |
| S-40 | state | phone 360×800 | [s-40-inbox-gol.png](screens/s-40-inbox-gol.png) | S-40 Inbox: gol |
| S-40 | main | tablet 1280×800 | [s-40-inbox-lista-si-citire-tableta.png](screens/s-40-inbox-lista-si-citire-tableta.png) | T S-40 Inbox: listă și citire (tabletă) |
| S-40 | main | web 1440×900 | [s-40-inbox-de-trimiteri-web.png](screens/s-40-inbox-de-trimiteri-web.png) | W S-40 Inbox de trimiteri (web) |
| S-41 | main | phone 360×800 | [s-41-cititor-de-trimitere.png](screens/s-41-cititor-de-trimitere.png) | S-41 Cititor de trimitere |
| S-41 | main | phone 360×1080 | [s-41-tipare-impartasite-de-autoare-editura.png](screens/s-41-tipare-impartasite-de-autoare-editura.png) | S-41 Tipare împărtășite de autoare (editură) |
| S-41 | state | phone 360×800 | [s-41-cititor-in-asteptare-descarcarea-e-oprita.png](screens/s-41-cititor-in-asteptare-descarcarea-e-oprita.png) | S-41 Cititor: În așteptare, descărcarea e oprită |
| S-41 | state | phone 360×800 | [s-41-cititor-acces-incheiat.png](screens/s-41-cititor-acces-incheiat.png) | S-41 Cititor: acces încheiat |
| S-41 | main | web 1440×900 | [s-41-cititor-de-trimitere-doua-panouri-web.png](screens/s-41-cititor-de-trimitere-doua-panouri-web.png) | W S-41 Cititor de trimitere (web, două panouri) |
| S-42 | main | phone 360×800 | [s-42-decizie-si-evaluare.png](screens/s-42-decizie-si-evaluare.png) | S-42 Decizie și evaluare |
| S-42 | state | phone 360×800 | [s-42-decizie-selectare-fara-evaluare.png](screens/s-42-decizie-selectare-fara-evaluare.png) | S-42 Decizie: selectare fără evaluare |
| S-42 | state | phone 360×800 | [s-42-decizie-in-asteptare.png](screens/s-42-decizie-in-asteptare.png) | S-42 Decizie: În așteptare |
| S-42 | main | web 1440×900 | [s-42-decizie-si-evaluare-web.png](screens/s-42-decizie-si-evaluare-web.png) | W S-42 Decizie și evaluare (web) |
| S-43 | main | web 1440×900 | [s-43-apeluri-si-concursuri-web.png](screens/s-43-apeluri-si-concursuri-web.png) | W S-43 Apeluri și concursuri (web) |
| S-44 | main | phone 360×800 | [s-44-aprobare-de-fragment.png](screens/s-44-aprobare-de-fragment.png) | S-44 Aprobare de fragment |
| S-44 | state | phone 360×800 | [s-44-aprobare-refuz-cu-mesaj.png](screens/s-44-aprobare-refuz-cu-mesaj.png) | S-44 Aprobare: refuz cu mesaj |
| S-44 | main | web 1440×900 | [s-44-cereri-de-aprobare-web.png](screens/s-44-cereri-de-aprobare-web.png) | W S-44 Cereri de aprobare (web) |
| S-50 | main | phone 360×800 | [s-50-acasa-dimineata.png](screens/s-50-acasa-dimineata.png) | S-50 Acasă · dimineața |
| S-50 | main | phone 360×800 | [s-50-acasa-seara-doar-antetul-se-schimba.png](screens/s-50-acasa-seara-doar-antetul-se-schimba.png) | S-50 Acasă · seara (doar antetul se schimbă) |
| S-50 | state | phone 360×800 | [s-50-acasa-nimic-nou-semnul-doarme.png](screens/s-50-acasa-nimic-nou-semnul-doarme.png) | S-50 Acasă · nimic nou (Semnul doarme) |
| S-51 | main | phone 360×800 | [s-51-postare-noua.png](screens/s-51-postare-noua.png) | S-51 Postare nouă |
| S-52 | main | phone 360×800 | [s-52-detaliu-postare.png](screens/s-52-detaliu-postare.png) | S-52 Detaliu postare |
| S-53 | main | phone 360×1000 | [s-53-cititor-de-fragment-hartie.png](screens/s-53-cititor-de-fragment-hartie.png) | S-53 Cititor de fragment · Hârtie |
| S-53 | state | phone 360×800 | [s-53-cititor-consimtamant-la-prima-deschidere.png](screens/s-53-cititor-consimtamant-la-prima-deschidere.png) | S-53 Cititor: consimțământ la prima deschidere |
| S-53 | state | phone 360×1000, Seara | [s-53-cititor-de-fragment-modul-seara-lumina-slaba.png](screens/s-53-cititor-de-fragment-modul-seara-lumina-slaba.png) | S-53 Cititor de fragment · modul Seara (lumină slabă) |
| S-54 | main | phone 360×800 | [s-54-pagina-unei-lucrari.png](screens/s-54-pagina-unei-lucrari.png) | S-54 Pagina unei lucrări |
| S-55 | main | phone 360×800 | [s-55-redistribuire.png](screens/s-55-redistribuire.png) | S-55 Redistribuire |
| S-55 | state | phone 360×800 | [s-55-redistribuire-sursa-indisponibila.png](screens/s-55-redistribuire-sursa-indisponibila.png) | S-55 Redistribuire: sursă indisponibilă |
| S-56 | main | phone 360×800 | [s-56-raportare.png](screens/s-56-raportare.png) | S-56 Raportare |
| S-57 | main | phone 360×1240 | [s-57-tipare-de-citire-autor.png](screens/s-57-tipare-de-citire-autor.png) | S-57 Tipare de citire (autor) |
| S-57 | main | phone 360×800 | [s-57-arata-tiparele-unei-edituri-foaie.png](screens/s-57-arata-tiparele-unei-edituri-foaie.png) | S-57 Arată tiparele unei edituri (foaie) |
| S-57 | state | phone 360×800 | [s-57-tipare-sub-prag.png](screens/s-57-tipare-sub-prag.png) | S-57 Tipare: sub prag |
| S-57 | main | web 1440×900 | [s-57-tipare-de-citire-web.png](screens/s-57-tipare-de-citire-web.png) | W S-57 Tipare de citire (web) |
| S-58 | main | phone 360×800 | [s-58-beta-cititori-autor.png](screens/s-58-beta-cititori-autor.png) | S-58 Beta-cititori (autor) |
| S-58 | state | phone 360×800 | [s-58-beta-cititori-fara-invitati.png](screens/s-58-beta-cititori-fara-invitati.png) | S-58 Beta-cititori: fără invitați |
| S-59 | main | phone 360×800 | [s-59-beta-lectura-cititor.png](screens/s-59-beta-lectura-cititor.png) | S-59 Beta-lectură (cititor) |
| S-59 | state | phone 360×800 | [s-59-beta-lectura-acces-retras.png](screens/s-59-beta-lectura-acces-retras.png) | S-59 Beta-lectură: acces retras |
| S-60 | main | phone 360×1330 | [s-60-biblioteca-mea.png](screens/s-60-biblioteca-mea.png) | S-60 Biblioteca mea |
| S-60 | main | phone 360×800 | [s-60-biblioteca-in-lista-cu-vizibilitate.png](screens/s-60-biblioteca-in-lista-cu-vizibilitate.png) | S-60 Bibliotecă: în listă, cu vizibilitate |
| S-60 | state | phone 360×800 | [s-60-biblioteca-raft-gol.png](screens/s-60-biblioteca-raft-gol.png) | S-60 Bibliotecă: raft gol |
| S-60 | main | web 1440×900 | [s-60-biblioteca-web.png](screens/s-60-biblioteca-web.png) | W S-60 Biblioteca (web) |
| S-61 | main | phone 360×800 | [s-61-scanner-isbn.png](screens/s-61-scanner-isbn.png) | S-61 Scanner ISBN |
| S-61 | state | phone 360×800 | [s-61-scanner-scanare-esuata.png](screens/s-61-scanner-scanare-esuata.png) | S-61 Scanner: scanare eșuată |
| S-61 | state | phone 360×800 | [s-61-scanner-permisiune-pentru-camera.png](screens/s-61-scanner-permisiune-pentru-camera.png) | S-61 Scanner: permisiune pentru cameră |
| S-61 | state | phone 360×800 | [s-61-scanner-se-cauta-cartea-evantaiul.png](screens/s-61-scanner-se-cauta-cartea-evantaiul.png) | S-61 Scanner: se caută cartea (evantaiul) |
| S-62 | main | phone 360×800 | [s-62-adaugare-manuala.png](screens/s-62-adaugare-manuala.png) | S-62 Adăugare manuală |
| S-63 | main | phone 360×1250 | [s-63-detaliu-carte-ecran-derulabil.png](screens/s-63-detaliu-carte-ecran-derulabil.png) | S-63 Detaliu carte (ecran derulabil) |
| S-63 | state | phone 360×800 | [s-63-detaliu-carte-fara-potrivire-pe-lisette.png](screens/s-63-detaliu-carte-fara-potrivire-pe-lisette.png) | S-63 Detaliu carte: fără potrivire pe Lisette |
| S-64 | main | phone 360×800 | [s-64-recenzie-si-nota.png](screens/s-64-recenzie-si-nota.png) | S-64 Recenzie și notă |
| S-64 | state | phone 360×800 | [s-64-recenzie-carte-nepublicata.png](screens/s-64-recenzie-carte-nepublicata.png) | S-64 Recenzie: carte nepublicată |
| S-70 | main | phone 360×800 | [s-70-cautare.png](screens/s-70-cautare.png) | S-70 Căutare |
| S-70 | state | phone 360×800 | [s-70-cautare-fara-rezultate.png](screens/s-70-cautare-fara-rezultate.png) | S-70 Căutare: fără rezultate |
| S-70 | state | phone 360×800 | [s-70-cautare-cautari-recente.png](screens/s-70-cautare-cautari-recente.png) | S-70 Căutare: căutări recente |
| S-71 | main | phone 360×900 | [s-71-harta-cu-evenimente-si-descoperiri.png](screens/s-71-harta-cu-evenimente-si-descoperiri.png) | S-71 Hartă cu evenimente și descoperiri |
| S-71 | state | phone 360×800 | [s-71-harta-vedere-lista.png](screens/s-71-harta-vedere-lista.png) | S-71 Hartă: vedere listă |
| S-71 | main | web 1440×900 | [s-71-harta-doar-vizualizare-web.png](screens/s-71-harta-doar-vizualizare-web.png) | W S-71 Hartă (web, doar vizualizare) |
| S-72 | main | phone 360×800 | [s-72-detaliu-eveniment.png](screens/s-72-detaliu-eveniment.png) | S-72 Detaliu eveniment |
| S-72 | state | phone 360×800 | [s-72-eveniment-anulat.png](screens/s-72-eveniment-anulat.png) | S-72 Eveniment: anulat |
| S-73 | main | phone 360×1000 | [s-73-editor-de-eveniment.png](screens/s-73-editor-de-eveniment.png) | S-73 Editor de eveniment |
| S-74 | main | phone 360×800 | [s-74-descoperire-esti-aproape.png](screens/s-74-descoperire-esti-aproape.png) | S-74 Descoperire: ești aproape |
| S-74 | main | phone 360×800 | [s-74-descoperire-deblocata-cu-stampila.png](screens/s-74-descoperire-deblocata-cu-stampila.png) | S-74 Descoperire: deblocată, cu ștampilă |
| S-74 | state | phone 360×800 | [s-74-descoperire-prea-departe.png](screens/s-74-descoperire-prea-departe.png) | S-74 Descoperire: prea departe |
| S-74 | state | phone 360×800 | [s-74-descoperire-permisiune-pentru-locatie.png](screens/s-74-descoperire-permisiune-pentru-locatie.png) | S-74 Descoperire: permisiune pentru locație |
| S-75 | main | phone 360×1000 | [s-75-descoperire-creator.png](screens/s-75-descoperire-creator.png) | S-75 Descoperire: creator |
| S-75 | state | phone 360×800 | [s-75-eliminare-completa-confirmare.png](screens/s-75-eliminare-completa-confirmare.png) | S-75 Eliminare completă: confirmare |
| S-76 | main | phone 360×800 | [s-76-descoperirile-mele.png](screens/s-76-descoperirile-mele.png) | S-76 Descoperirile mele |
| S-76 | main | phone 360×800 | [s-76-detaliu-descoperire-deblocata.png](screens/s-76-detaliu-descoperire-deblocata.png) | S-76 Detaliu descoperire deblocată |
| S-76 | state | phone 360×800 | [s-76-colectie-continut-eliminat.png](screens/s-76-colectie-continut-eliminat.png) | S-76 Colecție: conținut eliminat |
| S-80 | main | phone 360×800 | [s-80-notificari.png](screens/s-80-notificari.png) | S-80 Notificări |
| S-80 | main | phone 360×800 | [s-80-notificari-sesiune-lunga-grupate.png](screens/s-80-notificari-sesiune-lunga-grupate.png) | S-80 Notificări: sesiune lungă, grupate |
| S-80 | state | phone 360×800 | [s-80-notificari-gol.png](screens/s-80-notificari-gol.png) | S-80 Notificări: gol |
| S-80 | state | phone 360×800 | [s-80-notificari-fara-conexiune.png](screens/s-80-notificari-fara-conexiune.png) | S-80 Notificări: fără conexiune |
| S-80 | main | tablet 1280×800 | [s-80-notificari-lista-si-context-tableta.png](screens/s-80-notificari-lista-si-context-tableta.png) | T S-80 Notificări: listă și context (tabletă) |
| S-90 | main | web 1440×900 | [s-90-administrare-cereri-de-editura-web.png](screens/s-90-administrare-cereri-de-editura-web.png) | W S-90 Administrare: cereri de editură |
| S-91 | main | web 1440×900 | [s-91-administrare-rapoarte-web.png](screens/s-91-administrare-rapoarte-web.png) | W S-91 Administrare: rapoarte |

### Coverage against `docs/product/screens.md`
- **Screens in `screens.md` without a design:** none. Every ID from S-01 to S-91 has at least one frame.
- **Frames without an ID of their own in `screens.md`:**
  - *S-57 Arată tiparele unei edituri (foaie)*: the sheet for sharing reading patterns with a publisher, an action
    inside S-57.
  - *S-41 Tipare împărtășite de autoare (editură)*: the publisher's view of reading patterns an author shared.
- *S-20 / S-28 Manuscrise și trimiteri* covers two IDs in one scrolling frame.

## Boards
`boards/` holds the 13 page boards as FigCraft exported them: `00-fundamente.png`, `01-componente.png`, `02-iconite.png`, `03-mascota-si-ilustratii.png`, `04-decizii.png`, `10-acces-si-setari.png`, `11-profiluri.png`, `12-manuscrise-si-trimiteri.png`, `13-spatiul-editurii.png`, `14-comunitate.png`, `15-biblioteca.png`, `16-descopera-harta.png`, `17-notificari-administrare.png`.
Pages 00–04 are foundations, components, icons, mascot and illustrations, and design decisions. Pages 10–17 are
screens.

## Assets
| File | What it is |
|---|---|
| `assets/illustrations/antet-amiaza.svg` | Home header, 360×150: a street with a bookshop, midday |
| `assets/illustrations/antet-dimineata.svg` | Home header, 360×150: a street with a bookshop, morning |
| `assets/illustrations/antet-seara.svg` | Home header, 360×150: a street with a bookshop, evening |
| `assets/illustrations/semn-atent.svg` | Mascot attentive, with a lock: consent, privacy, authentication |
| `assets/illustrations/semn-avatar-fular.svg` | Avatar accessory variant: waving mascot with a scarf |
| `assets/illustrations/semn-avatar-ochelari.svg` | Avatar accessory variant: waving mascot with glasses |
| `assets/illustrations/semn-avatar-stea.svg` | Avatar accessory variant: waving mascot with a four-point star |
| `assets/illustrations/semn-bucurie.svg` | Mascot pleased: a completed action (first submission, finished book) |
| `assets/illustrations/semn-citeste.svg` | Mascot reading: reading, excerpt loading |
| `assets/illustrations/semn-doarme.svg` | Mascot asleep: nothing new (empty feed or notifications) |
| `assets/illustrations/semn-ganduri.svg` | Mascot thoughtful: error or no results; never used as a joke |
| `assets/illustrations/semn-lupa.svg` | Mascot with a magnifier: ISBN scan, search |
| `assets/illustrations/semn-salut.svg` | Bookmark mascot, waving: onboarding, welcome |
| `assets/illustrations/semn-scrie.svg` | Mascot writing: manuscripts, new post |
| `assets/illustrations/reactie-imi-place.svg`, `reactie-ok.svg`, `reactie-nu-imi-place.svg` | Added 2026-11-11, not from v6: the mascot's three reaction faces (heart eyes, neutral, frown with a tear), 48×48, used in the reaction panel and summary. |
| `assets/icons/*.svg` (55) | Line icons, 24×24, 1.75 px stroke, `stroke="currentColor"`: the minimalist D set (`lib.ICONS`) plus `rd_comps.EXTRA` (`glob`, `luna`, `soare`, `mai-mult`, `carte`, `stampila`). `star-fill` is the filled rating star. `reaction-love`, `reaction-okay` and `reaction-dislike` (added 2026-11-11, not from v6) are the bookmark mascot's smile, neutral and frown, used for the three reactions. `repost` (added 2026-11-11, not from v6) is the two-arrow loop for resharing inside Lisette, kept apart from `share` (sharing outside the app). |
| `assets/reference/book-cover-card-variants.png` | The generated book cover in the book card: 4 cover colours × 3 visibility chips. **Reference only, not a production asset.** |
| `assets/reference/four-point-star-sizes.png` | The four-point star from the logo at 8, 12, 18 and 26 px. **Reference only.** Vector logo production files are still pending in `brand/`. |

Icons: `alert`, `arrow-left`, `bell`, `bookmark`, `calendar`, `camera`, `carte`, `check`, `check-circle`, `chevron-right`, `clock`, `comment`, `compass`, `download`, `edit`, `external`, `eye`, `filter`, `fingerprint`, `flag`, `glob`, `home`, `image`, `inbox`, `info`, `library`, `list`, `lock`, `luna`, `mai-mult`, `mail`, `manuscript`, `map`, `map-pin`, `pause`, `plus`, `retry`, `search`, `send`, `share`, `soare`, `stampila`, `star`, `star-fill`, `trash`, `undo`, `upload`, `user`, `users`, `x`, `x-circle`. The screen code also uses Romanian aliases for the D names
(`rd_comps.FROM_D`, for example `acasa` = `home`, `lacat` = `lock`, `amprenta` = `fingerprint`).

The illustrations keep the generator's colours (`rd_art.ART`) and are not redrawn. This folder contains no
photographs or placeholders.

## Tokens
[`tokens.json`](tokens.json) is derived from `rd_ds` and checked against the FigCraft variables. All colour and
dimension values match, and the file has no variables beyond the generator's. It lists colours for both modes
(Hârtie for the app, Seara for the reading mode), 19 text styles, spacing `sp-1` to `sp-8` (4–40 px), radii
(`r-sm` 12, `r-md` and `r-lg` 20, `r-xl` 24, `r-pill` 999), a 48 px minimum touch target and two shadow effect styles.

### Differences from `brand/brand.yaml`
- **Base palette:** all five approved colours are used. Solid fills and strokes on the screen pages: Ink 2801,
  Paper 728, Gold 699, Burgundy 633, Night burgundy 7 (the Seara
  reader, the evening Home header and two book spines). In Seara, `primary` becomes Gold with Ink labels, as `brand/identity.md` §03 suggests for
  dark mode.
- **Extra opaque colours (39):** tints and shades between the approved colours.
  `brand/identity.md` §03 treats additional surface shades as proposals to test, not approved base colours. The most
  visible is `#FCF8F1`, a lighter Paper used for cards, fields and sheets.

| Hex | Tokens |
|---|---|
| `#1E0A10` | `canvas` |
| `#2E1A1F` | `niche`, `raft-fundal` |
| `#45302F` | `ilu/fereastra-stinsa` |
| `#4A222B` | `field`, `ilu/noapte-spate`, `sheet`, `surface` |
| `#4A2F20` | `lemn-muchie` |
| `#4B2B2F` | `gold-soft` |
| `#512C34` | `surface-2` |
| `#5A2A33` | `primary-soft` |
| `#5E3740` | `surface-3` |
| `#5F1A28` | `primary-pressed`, `semn/umbra` |
| `#69494E` | `border`, `line` |
| `#6A5D56` | `chrome-muted`, `cotor/cenusa`, `field-muted`, `ink-muted`, `text-muted` |
| `#6B4630` | `lemn` |
| `#7E5536` | `lemn-muchie` |
| `#8A2C3E` | `semn/tesatura` |
| `#98807F` | `border-strong`, `line-strong` |
| `#9C8D80` | `border-strong`, `line-strong` |
| `#A9784E` | `lemn` |
| `#B3873F` | `primary-pressed` |
| `#BEADA7` | `chrome-muted`, `field-muted`, `text-muted` |
| `#C98C96` | `cotor/visiniu-pal`, `ilu/frunze-2`, `ilu/perdea` |
| `#C9AE92` | `ilu/amiaza-fata` |
| `#D9C3AE` | `ilu/zi-fata` |
| `#DCD2CB` | `nuanta/cerneala` |
| `#E0D4C2` | `border`, `line` |
| `#E2CDB0` | `ilu/amiaza-spate` |
| `#E4C995` | `cotor/aur-pal` |
| `#E4DDD2` | `canvas` |
| `#E5D9C6` | `surface-3` |
| `#E9CFD3` | `nuanta/visiniu` |
| `#EADCC2` | `cotor/hartie`, `ilu/zi-spate`, `nuanta/hartie` |
| `#EDE3D3` | `niche`, `raft-fundal` |
| `#EFD9AE` | `nuanta/aur` |
| `#EFE6D8` | `surface-2` |
| `#F1DFE0` | `primary-soft` |
| `#F3E3C4` | `ilu/amiaza-cer` |
| `#F3E6CC` | `gold-soft` |
| `#FBF3E6` | `ilu/amiaza-fereastra`, `ilu/zi-cer`, `ilu/zi-fereastra` |
| `#FCF8F1` | `field`, `ilu/nor`, `sheet`, `surface` |

- **Extra translucent colours:** Gold at about 22 %, 40 % and 60 % for the reading-pattern heatmap, plus Ink or
  near-black for shadows and scrims.

| Hex | Tokens |
|---|---|
| `#0000008C` | `shadow (seara)` |
| `#0D0A0BB3` | `scrim (seara)` |
| `#2E1F1A24` | `shadow (hartie)` |
| `#2E1F1A80` | `scrim (hartie)` |
| `#C99A4E38` | `heat-1 (hartie)`, `heat-1 (seara)` |
| `#C99A4E66` | `heat-2 (hartie)`, `heat-2 (seara)` |
| `#C99A4E99` | `heat-3 (hartie)`, `heat-3 (seara)` |

- **Colours defined but not bound on any screen:** `action`, `canvas`, `chrome`, `chrome-muted`, `field`, `field-muted`, `field-text`, `on-accent`, `on-chrome`, `primary-pressed`, `shadow`, `sheet`, `spine`. Most are aliases kept for the older D screen code.
  `shadow` is used through the two effect styles rather than bound to layers.
- **Fonts:** only the approved families, Newsreader, Literata and Inter. Text layers on the screen pages: Inter Regular (791), Inter Medium (488), Newsreader SemiBold (400), Inter Semi Bold (324), Literata Regular (71), Literata Italic (11), Newsreader Italic (6), Newsreader Medium (3).
- **Heatmap:** v6 draws reading patterns as Gold "light traces" on Paper. `brand/identity.md` §03 proposes a
  Paper-to-Burgundy scale to test. Both are proposals.

## Screens drawn before later decisions
These screens show behaviour that changed on 2026-10-21. Build the documented behaviour, not the drawing:
- **S-02 Creează cont:** sign-up must also let the person choose the account kind (person or publication). Every account is not a reader first; a publication is its own account.
- **S-05 Cerere de cont de editură:** drawn as a request made from a person's account. A publication now signs up with its own email as a separate account, chooses its kind (publishing house, literary magazine or independent editor) and can post, comment, share quotes and create events while approval is pending.
- **S-14 Setările editurii:** "Primesc manuscrise direct", the required materials and the genres/languages are no longer publisher settings. They belong to each call (S-43); an always-open call replaces direct submissions. Profile genres, resubmission and the sharing policy stay in publisher settings.
- **S-24 Catalog / S-13 Profil de editură:** "accepts submissions now" comes from having an open call; add a filter by publication kind.
- **S-62 Adăugare manuală:** before saving, show "Is this the book?" with existing similar books to pick from, or "add a new book".
- **Not drawn yet:** a publication sharing a quote as a preview (choosing its own published book or a received manuscript), and the author's screen to approve such a quote.

## Proposed, not decided
Each v6 choice below contradicts an approved document. Agents follow the approved documents until the user decides
otherwise.

a) **A mascot with a face.** The bookmark mascot (the `semn-*` illustrations, avatars and empty states) has eyes,
   cheeks, a smile and details such as weave, stitching, a tassel and accessories. **Decided 2026-11-11:** the
   mascot is approved as drawn, for empty states, moments and default avatars; `brand/identity.md` §06 and
   `brand/brand.yaml` (`illustration`) are updated.

b) **Soft shadows on floating elements.** v6 defines two effect styles, `Umbră/card` and `Umbră/plutitor`. On the
   screen pages only `Umbră/plutitor` is applied: to the bottom navigation bars, the central "+" button and bottom
   sheets. `brand/identity.md` lists "Gradients, glows and drop shadows" under
   *What to avoid*. That list sits in §02, *Logo Direction*, so whether it also covers the interface is for the user to
   confirm. **Decided 2026-10-28 for the bottom bar and its "+" button:** use `Umbră/plutitor` as drawn. Cards and
   bottom sheets are still undecided.

c) **A dark theme only in the reader (Seara).** v6 makes Paper the only app theme. The only Night burgundy screen is
   the reading mode that ambient light switches on (S-53 Seara); evening otherwise changes only the Home header. `docs/product/screens.md` S-06 asks for an appearance
   setting of light, dark or auto, and `brand/identity.md` §03 gives dark-mode UI rules.
