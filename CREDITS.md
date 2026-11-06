# Photo credits

Background photos come from Wikimedia Commons and are all public domain or CC0.
They were resized (768 px), cropped to the play area and tinted for the sunset/night stages.
Licence audit 2026-11-07: the 23 CC BY / CC BY-SA photos were removed, because those licences forbid
distribution under technological protection measures (app-store DRM such as Apple FairPlay). Those
maps now play on the bare table (`NO_PHOTO` in `src/sim/maps.js`).
Licences and authors were re-checked against the Commons file pages on 2026-10-26 (landmarks) and 2026-10-27 (the 12 "경이의 세계" photos).

| Landmark | Photo | Author | Licence |
|---|---|---|---|
| liberty | [Front_view_of_Statue_of_Liberty_(cropped).jpg](https://commons.wikimedia.org/wiki/File:Front_view_of_Statue_of_Liberty_(cropped).jpg) | AskALotl | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) |
| eiffel | [Tour_Eiffel_Wikimedia_Commons_(cropped).jpg](https://commons.wikimedia.org/wiki/File:Tour_Eiffel_Wikimedia_Commons_(cropped).jpg) | Benh LIEU SONG | Public domain |
| sphinx | [Sphinx_with_the_third_pyramid.jpg](https://commons.wikimedia.org/wiki/File:Sphinx_with_the_third_pyramid.jpg) | Hesham Ebaid | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) |
| grandCanyon | [Grand Canyon National Park, View from Hermits Rest 4235 - Flickr - Grand Canyon NPS.jpg](https://commons.wikimedia.org/wiki/File:Grand_Canyon_National_Park,_View_from_Hermits_Rest_4235_-_Flickr_-_Grand_Canyon_NPS.jpg) | Grand Canyon National Park | Public domain |
| saturn | [Saturn during Equinox.jpg](https://commons.wikimedia.org/wiki/File:Saturn_during_Equinox.jpg) | NASA / JPL / Space Science Institute | Public domain |
| curiosity | [Curiosity selfie on Mars.jpg](https://commons.wikimedia.org/wiki/File:Curiosity_selfie_on_Mars.jpg) | NASA | Public domain |
| earthrise | [NASA-Apollo8-Dec24-Earthrise.jpg](https://commons.wikimedia.org/wiki/File:NASA-Apollo8-Dec24-Earthrise.jpg) | NASA/Bill Anders | Public domain |
| dumbo | [Dumbo-hires.jpg](https://commons.wikimedia.org/wiki/File:Dumbo-hires.jpg) | NOAA Okeanos Explorer | Public domain |
| blackSmoker | [Blacksmoker in Atlantic Ocean.jpg](https://commons.wikimedia.org/wiki/File:Blacksmoker_in_Atlantic_Ocean.jpg) | P. Rona / OAR/National Undersea Research Program (NURP); NOAA | Public domain |
| jellyfish | [Halitrephes Maasi.jpg](https://commons.wikimedia.org/wiki/File:Halitrephes_Maasi.jpg) | NOAA Office of Ocean Exploration and Research | Public domain |
| lavaFountain | [Pahoeoe fountain edit2.jpg](https://commons.wikimedia.org/wiki/File:Pahoeoe_fountain_edit2.jpg) | J.D. Griggs | Public domain |
| aurora | [Aurora borealis over Eielson Air Force Base, Alaska.jpg](https://commons.wikimedia.org/wiki/File:Aurora_borealis_over_Eielson_Air_Force_Base,_Alaska.jpg) | United States Air Force photo by Senior Airman Joshua Strang | Public domain |
| supercell | [Supercell-thunderstorm-in-Kansas.jpg](https://commons.wikimedia.org/wiki/File:Supercell-thunderstorm-in-Kansas.jpg) | NOAA National Severe Storms Laboratory | Public domain |

# Generated artwork

Fruit, special-block icons, brick/table/floor surfaces and boss skins in `public/art/` were generated for this game on a local machine with [Z-Image-Turbo](https://huggingface.co/Tongyi-MAI/Z-Image-Turbo) (Tongyi-MAI, model licence [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0), checked on the model card 2026-10-27), then cut out, made tileable and resized. No reference images or third-party artwork were used as input; prompts describe generic objects and materials only.

The UI and achievement icons in `public/art/ui/`, the app icon and splash (`assets/`, `public/icon-*.png`), the title key art and the share image (`public/og-image.jpg`) were made with [Higgsfield](https://higgsfield.ai) (GPT Image 2.5) on 2026-10-28, on a paid plan, then cropped, resized and composited locally (`scripts/art/hf-*.py`). Higgsfield claims no ownership of outputs and its Terms of Use do not restrict commercial use ([help centre](https://higgsfield.ai/creator-hub/help-center/account-and-privacy/who-owns-my-generations-and-can-i-use-them-commercially), checked 2026-10-28). The only reference image was this game's own apple picture (for a matching style); prompts describe generic objects and toy-brick buildings, no real people, logos or trademarks. The boss portraits in `public/art/boss/` (entrance and KO cards) were made the same way on 2026-10-28, each with a render of that boss's own 3D model (below) as its reference picture (`scripts/art/boss-shots.html`). The 놀이 세계 animals (cat, dog, rabbit, panda, penguin, lion) were made the same way on 2026-10-29: a pixel-art sprite from a text prompt, turned into a brick mural (`scripts/art/play-murals.py`), and a background scene drawn with that sprite as reference (`public/landmarks/<animal>.jpg`, not from Wikimedia Commons, so they are not in the in-game photo credits). The number, alphabet and Hangul murals are drawn from glyphs of [Pretendard](https://github.com/orioncactus/pretendard) Black (SIL Open Font License 1.1, already listed in `licenses.txt`).

The boss bodies in `public/art/model/` (the four big bosses and the 36 map bosses, one per map) were made with [Ludo.ai](https://ludo.ai) on 2026-10-27 (big four) and 2026-10-28 (map bosses): a character image from a text prompt, then image-to-3D (Hero model), then compressed with [glTF-Transform](https://gltf-transform.dev) (MIT; map bosses use meshopt, decoded by three.js's bundled MeshoptDecoder, MIT). Under the [Ludo Terms of Service](https://ludo.ai/terms-of-service) generated assets are licensed for personal and commercial use (non-exclusive, worldwide). Prompts describe generic creatures, animals, folklore beasts (e.g. haetae, bulgasari, firebird, Prague golem) and machines; no reference images, real people or trademarks were used.
