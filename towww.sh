#!/bin/bash
# recover three.js: 
# wget https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

# multi-file (unminified) version needs:
# adastra.html, adastra.css
# physics.js, shaderstring.js, constellations.js, extrasolar.js, data.js, three.min.js


cp adastra.html /tmp/ ; sudo mv /tmp/adastra.html /var/www/html/adastra/
cp adastra.css /tmp/ ; sudo mv /tmp/adastra.css /var/www/html/adastra/
cp physics.js /tmp/ ; sudo mv /tmp/physics.js /var/www/html/adastra/
cp shaderstring.js /tmp/ ; sudo mv /tmp/shaderstring.js /var/www/html/adastra/
cp texture.js /tmp/ ; sudo mv /tmp/texture.js /var/www/html/adastra/
cp constellations.js /tmp/ ; sudo mv /tmp/constellations.js /var/www/html/adastra/
cp extrasolar.js /tmp/ ; sudo mv /tmp/extrasolar.js /var/www/html/adastra/
cp data.js /tmp/ ; sudo mv /tmp/data.js /var/www/html/adastra/

