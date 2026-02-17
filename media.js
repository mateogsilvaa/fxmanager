document.addEventListener('DOMContentLoaded', () => {
    const photoGallery = document.querySelector('.photo-gallery');
    const videoGallery = document.querySelector('.video-gallery');

    if (!photoGallery || !videoGallery) {
        console.error('No se encontraron las galerías de fotos o videos.');
        return;
    }

    fetch('media.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar los datos de media: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            // Limpiar galerías antes de agregar nuevo contenido
            photoGallery.innerHTML = '';
            videoGallery.innerHTML = '';

            // Cargar fotos
            if (data.photos && data.photos.length > 0) {
                data.photos.forEach(photo => {
                    const photoElement = document.createElement('div');
                    photoElement.classList.add('photo');
                    photoElement.innerHTML = `<img src="${photo.src}" alt="${photo.alt}">`;
                    photoGallery.appendChild(photoElement);
                });
            } else {
                photoGallery.innerHTML = '<p>No hay fotos disponibles.</p>';
            }

            // Cargar videos
            if (data.videos && data.videos.length > 0) {
                data.videos.forEach(video => {
                    const videoElement = document.createElement('div');
                    videoElement.classList.add('video');
                    videoElement.innerHTML = `<iframe src="${video.src}" frameborder="0" allowfullscreen></iframe>`;
                    videoGallery.appendChild(videoElement);
                });
            } else {
                videoGallery.innerHTML = '<p>No hay videos disponibles.</p>';
            }
        })
        .catch(error => {
            console.error('Error en la carga de contenido multimedia:', error);
            photoGallery.innerHTML = '<p>Error al cargar las fotos.</p>';
            videoGallery.innerHTML = '<p>Error al cargar los videos.</p>';
        });
});

