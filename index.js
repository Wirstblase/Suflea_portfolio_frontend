document.addEventListener('DOMContentLoaded', () => {

    const urlstring= "https://portfoliobackend.mariussuflea.com" // for local testing: http://127.0.0.1:5000

    const scrollPosition = window.location.hash.substring(1);
    if (scrollPosition) {
        window.scrollTo(0, parseInt(scrollPosition, 10));
    }

    const specialHeader = document.getElementById('special-header');
    const projectTypesContainer = document.getElementById('project-types');
    const projectsGrid = document.getElementById('projects-grid');
    const sortButton = document.getElementById('sort-button');
    let sortType = 'newest';

    // Fetch project types
    fetch(`${urlstring}/get_project_types`)
        .then(response => response.json())
        .then(types => {
            types.forEach(type => {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = type;
                checkbox.name = 'project-type';
                checkbox.value = type;
                checkbox.checked = true;

                const label = document.createElement('label');
                label.htmlFor = type;
                label.textContent = type;

                projectTypesContainer.appendChild(checkbox);
                projectTypesContainer.appendChild(label);
            });

            // Initial fetch after checkboxes are populated
            fetchAndDisplayProjects();
        });

    // Fetch and display projects
    const fetchAndDisplayProjects = () => {
        const selectedTypes = Array.from(document.querySelectorAll('input[name="project-type"]:checked'))
            .map(checkbox => checkbox.value)
            .join(',');

        console.log(`Selected Types: ${selectedTypes}`);
        console.log(`Sort Type: ${sortType}`);

        fetch(`${urlstring}/get_max_index_for_custom?types=${selectedTypes}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const maxIndex = data.max_index;
                console.log(`Max Index: ${maxIndex}`);

                const requestUrl = `${urlstring}/get_projects_custom?types=${selectedTypes}&start_index=0&end_index=${maxIndex}&sort_type=${sortType}`;
                console.log(`Fetch Request URL: ${requestUrl}`);

                return fetch(requestUrl);
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(projects => {
                console.log('Projects:', projects);
                projectsGrid.innerHTML = '';
                projects.forEach(project => {
                    const [type, title, date] = project.split('⌭');
                    console.log('Project Details:', { type, title, date });

                    const projectElement = document.createElement('div');
                    projectElement.className = 'project';

                    const img = document.createElement('img');
                    img.src = `${urlstring}/get_project_picture?path=${type}/${title}&filename=thumbnail.jpg`;
                    img.alt = title;

                    const projectTitle = document.createElement('h3');
                    projectTitle.textContent = title;

                    const projectType = document.createElement('p');
                    projectType.textContent = `Type: ${type}`;

                    const projectDate = document.createElement('p');
                    projectDate.textContent = `Year: ${date.split('.').pop()}`;

                    projectElement.appendChild(img);
                    projectElement.appendChild(projectTitle);
                    projectElement.appendChild(projectType);
                    projectElement.appendChild(projectDate);

                    projectElement.addEventListener('click', () => {
                        const scrollPosition = window.scrollY;
                        localStorage.setItem('scrollPosition', scrollPosition);
                        window.location.href = `project.html?type=${type}&title=${title}`;
                    });

                    projectsGrid.appendChild(projectElement);
                });
            })
            .catch(error => {
                console.error('Error fetching projects:', error);
            });
    };

    const adjustMargin = () => { //todo: adjust formulas, they are not great right now
        var newMarginBottom = -window.innerWidth * 0.3; // Adjust this factor as needed
        var newMarginLR = -window.innerHeight * 0.24; // Adjust this factor as needed

        if(newMarginBottom < -410){
            newMarginBottom = -410;
        }
        if(newMarginBottom > -200){
            newMarginBottom = -200;
        }
        //specialHeader.style.marginBottom = `${newMarginBottom}px`;

        //console.log('Adjusted Spline margin:', newMarginBottom);

        //body margin, we should add them only if the screen is very wide
        const screen_ratio = window.innerWidth / window.innerHeight;
        var bodyMarginLR = 0;

        //console.log('Screen ratio:', screen_ratio);

        //ratio > 1.9, add margins

        if(screen_ratio > 1.7){
            bodyMarginLR = (window.innerWidth - window.innerHeight * 1.8) / 2;

            newMarginLR = newMarginLR - (bodyMarginLR*2);
        }

        console.log('Body margin:', bodyMarginLR);
        if(bodyMarginLR > 200){
            bodyMarginLR = 100;
        }

        //document.body.style.marginLeft= `${bodyMarginLR}px`;
        //document.body.style.marginRight= `${bodyMarginLR}px`;

        //specialHeader.style.marginLeft = `${newMarginLR}px`;
        //specialHeader.style.marginRight = `${newMarginLR}px`;
    };

    //adjustMargin();

    // Event listeners
    //window.addEventListener('resize', adjustMargin);
    projectTypesContainer.addEventListener('change', fetchAndDisplayProjects);
    sortButton.addEventListener('click', () => {
        sortType = sortType === 'newest' ? 'oldest' : 'newest';
        sortButton.textContent = `Sort: ${sortType.charAt(0).toUpperCase() + sortType.slice(1)}`;
        /*if(sortType === 'newest'){
            sortButton.textContent = 'Showing newest projects first';
        } else if(sortType === 'oldest') {
            sortButton.textContent = 'Showing oldest projects first';
        }*/
        fetchAndDisplayProjects();
    });
});