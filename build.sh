#!/bin/bash
# recover three.js:
# wget https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

mkdir /tmp/minify
cp /var/www/html/adastra/three.min.js /tmp/minify/

#build data.js from txt database files: needs files
# milkyway_particles.csv, star_name_map.dat, stars.dat
python3 ./txt2js.py

python3 glsl_minify.py shaderstring.js minishader.js

# generates /tmp/minify/adastra_bundle.html: needs files
#adastra.css, adastra.html, data.js , physics.js, shaderstring.js, texture.js, constellations.js, extrasolar.js, three.min.js
python3 ./minify.py

#move to web directory
sudo cp /tmp/minify/adastra_bundle.html /var/www/html/adastra/index.html

# multi-file (unminified) version needs:
# adastra.html, adastra.css
# physics.js, galaxymap.js, shaderstring.js, constellations.js, extrasolar.js, data.js, three.min.js

cp adastra.html /tmp/ ; sudo mv /tmp/adastra.html /var/www/html/adastra/
cp adastra.css /tmp/ ; sudo mv /tmp/adastra.css /var/www/html/adastra/
cp physics.js /tmp/ ; sudo mv /tmp/physics.js /var/www/html/adastra/
cp shaderstring.js /tmp/ ; sudo mv /tmp/shaderstring.js /var/www/html/adastra/
cp texture.js /tmp/ ; sudo mv /tmp/texture.js /var/www/html/adastra/
cp constellations.js /tmp/ ; sudo mv /tmp/constellations.js /var/www/html/adastra/
cp extrasolar.js /tmp/ ; sudo mv /tmp/extrasolar.js /var/www/html/adastra/
cp galaxymap.js /tmp/ ; sudo mv /tmp/galaxymap.js /var/www/html/adastra/
# remember to move updated data.js to web directory:
#sudo mv /tmp/minify/data.js /var/www/html/adastra/
