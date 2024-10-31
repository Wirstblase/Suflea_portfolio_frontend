document.addEventListener('DOMContentLoaded', () => {

    //todo: add better text-image embedding, randomize float direction

    const urlstring = "https://portfoliobackend.mariussuflea.com" // for local testing: http://127.0.0.1:5000

    const urlParams = new URLSearchParams(window.location.search);
    const projectType = urlParams.get('type');
    const projectTitle = urlParams.get('title');

    document.getElementById('project-type').textContent = projectType;
    document.getElementById('project-title').textContent = projectTitle;

    document.getElementById('back-button').addEventListener('click', () => {
        history.back();
    });

    const validExtensions = ['jpg', 'JPG', 'jpeg', 'JPEG', 'png', 'PNG'];
    const excludedFiles = ['thumbnail.jpg'];

    const filterPics = (pics) => {

        pics = pics['pics_filenames']
        var filteredPics = []
        //remove elements from pics that don't have valid extensions, by going through all elements of pics and checking if the extension is in validExtensions
        for (let i = pics.length - 1; i >= 0; i--) {

            //console.log('i', i);

            const extension = pics[i].split('.').pop();

            //console.log('extension:', extension);

            if (validExtensions.includes(extension)) {

                if (!excludedFiles.includes(pics[i])) {
                    filteredPics.push(pics[i]);
                }

            }
        }

        //keep only the pics that start with low-res_
        filteredPics = filteredPics.filter(pic => pic.startsWith('low-res_'));

        //sort pics alphabetically
        filteredPics.sort();

        console.log('all files:', pics);
        console.log('Filtered Pics:', filteredPics);

        return filteredPics;
    }

    const fetchProjectPics = async () => {
        const response = await fetch(`${urlstring}/get_project_pics_names?path=${projectType}/${projectTitle}`);
        const data = await response.json();
        return filterPics(data);
    };

    const fetchCaption = async (pic) => {
        const response = await fetch(`${urlstring}/get_project_picture?path=${projectType}/${projectTitle}&filename=${pic}.txt`);
        if (response.ok) {
            return await response.text();
        }
        return 'no caption';
    };

    const fetchProjectDescription = async () => {
        const response = await fetch(`${urlstring}/get_project_description?path=${projectType}/${projectTitle}`);
        if (response.ok) {
            return await response.text();
        }
        return 'no description';
    }

    const displayProjectDetails = async () => {
        const pics = (await fetchProjectPics()) //.reverse();

        const descriptionData = await fetchProjectDescription();
        const descriptionText = JSON.parse(descriptionData)['description_body'];

        const projectDetails = document.getElementById('project-details');

        //console.log('Pics:', pics);

        //console.log('Description:', descriptionText);

        // Create a container for the description text
        const descriptionContainer = document.createElement('div');
        descriptionContainer.className = 'description-container';
        descriptionContainer.innerHTML = descriptionText;


        //NEEDS WORK
        const textLength = descriptionText.length;
        const numImagesToEmbed = Math.min(Math.floor(textLength / 1000), pics.length); // Embed 1 image per 1000 characters of text

        //NEEDS WORK
        for (let i = 0; i < numImagesToEmbed; i++) {
            const imgElement = document.createElement('img');
            imgElement.src = `${urlstring}/get_project_picture?path=${projectType}/${projectTitle}&filename=${pics[i]}`;
            imgElement.alt = pics[i];
            imgElement.className = 'embedded-image';
            imgElement.addEventListener('click', () => openModal(pics[i]));

            //todo: make it so that the images are embedded in random places in the text, not only on the right side, and determine some amount of text to be left inbetween the embeds and after the last image
            const textNode = descriptionContainer.childNodes[Math.floor((i + 1) * descriptionContainer.childNodes.length / (numImagesToEmbed + 1))];
            descriptionContainer.insertBefore(imgElement, textNode);
        }

        projectDetails.appendChild(descriptionContainer);

        // Display remaining images in a gallery view
        if (numImagesToEmbed < pics.length) {


            const galleryContainer = document.createElement('div');
            galleryContainer.className = 'gallery-container';

            for (let i = numImagesToEmbed; i < pics.length; i++) {
                const imgElement = document.createElement('img');
                imgElement.src = `${urlstring}/get_project_picture?path=${projectType}/${projectTitle}&filename=${pics[i]}`;
                imgElement.alt = pics[i];
                imgElement.className = 'gallery-image';
                imgElement.addEventListener('click', () => openModal(pics[i]));

                const caption = await fetchCaption(pics[i]);
                const captionElement = document.createElement('p');
                captionElement.textContent = caption;

                const container = document.createElement('div');
                container.className = 'gallery-item';
                container.appendChild(imgElement);
                if (caption) {
                    container.appendChild(captionElement);
                }

                galleryContainer.appendChild(container);
            }

            projectDetails.appendChild(galleryContainer);
        }


    };

    const openModal = (pic) => {
        const modal = document.getElementById('image-modal');
        const modalImg = document.getElementById('full-res-image');
        modal.style.display = 'flex';
        const fullResPic = pic.replace('low-res_', '');
        modalImg.src = `${urlstring}/get_project_picture?path=${projectType}/${projectTitle}&filename=${fullResPic}`;
    };

    const closeModal = () => {
        const modal = document.getElementById('image-modal');
        modal.style.display = 'none';
    };

    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('image-modal').addEventListener('click', (event) => {
        if (event.target === event.currentTarget) {
            closeModal();
        }
    });

    displayProjectDetails();

});