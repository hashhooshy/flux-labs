// flux_commands.ts

import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global state and UI references
let dynamicOutputContainer: HTMLElement | null = null;
let iframeViewContainer: HTMLElement | null = null;
let iframeContainer: HTMLElement | null = null;
let outputContainer: HTMLElement | null = null;
let customAlertModal: HTMLElement | null = null;
let customAlertText: HTMLElement | null = null;
let customAlertClose: HTMLElement | null = null;

// New state object to hold dynamic values
export const state: { [key: string]: any } = {};
export const activeModals: { [key: string]: HTMLElement } = {};

/**
 * Initializes the command service by getting necessary DOM elements.
 * This should be called once the DOM is ready.
 */
export function initializeFluxCommands() {
    dynamicOutputContainer = document.getElementById('dynamic-output');
    iframeViewContainer = document.getElementById('iframe-view-container');
    iframeContainer = document.getElementById('iframe-container');
    outputContainer = document.getElementById('rendered-output');
    customAlertModal = document.getElementById('custom-alert-modal');
    customAlertText = document.getElementById('custom-alert-text');
    customAlertClose = document.getElementById('custom-alert-close');
    
    if (customAlertClose) {
        customAlertClose.onclick = () => hideCustomAlert();
    }
}

// --- Utility Functions ---

export const wait = (seconds: number): Promise<void> => new Promise(resolve => setTimeout(resolve, seconds * 1000));

export const showCustomAlert = (message: string) => {
    if (customAlertModal && customAlertText) {
        customAlertText.innerHTML = message;
        customAlertModal.classList.remove('hidden');
    }
};

const hideCustomAlert = () => {
    if (customAlertModal) {
        customAlertModal.classList.add('hidden');
    }
};

export const showIframeView = (url: string) => {
    if (outputContainer && iframeViewContainer && iframeContainer) {
        outputContainer.classList.add('hidden');
        iframeViewContainer.classList.remove('hidden');
        iframeContainer.innerHTML = `<iframe src="${url}"></iframe>`;
    }
};

export const showMainAppView = () => {
    if (iframeViewContainer && outputContainer && iframeContainer) {
        iframeViewContainer.classList.add('hidden');
        outputContainer.classList.remove('hidden');
        iframeContainer.innerHTML = '';
    }
};

/**
 * Replaces placeholders like `{my_variable}` with values from the state.
 * @param text The text containing placeholders.
 * @returns The text with placeholders replaced.
 */
const replaceStateVariables = (text: string): string => {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
        return state[key] !== undefined ? state[key] : match;
    });
};

// --- Command Execution Logic ---

/**
 * Executes a single command.
 * @param command The command object with 'type' and 'props'.
 * @param targetContainer The DOM element to append the output to.
 * @param event The event object if triggered by a user action.
 */
export const processCommand = async (command: any, targetContainer: HTMLElement, event?: Event) => {
    const type = command?.type;
    const props = command?.props || {};
    let element;

    // Replace state variables in props before processing
    for (const key in props) {
        if (typeof props[key] === 'string') {
            props[key] = replaceStateVariables(props[key]);
        }
    }

    switch (type) {
        // Basic UI Commands
        case 'heading': {
            const HeadingTag = (props.size as 'h1' | 'h2' | 'h3' | 'h4') || 'h2';
            element = document.createElement(HeadingTag);
            element.textContent = props.text;
            element.className = `font-bold ${props.color || 'text-gray-900'}`;
            break;
        }
        case 'paragraph': {
            element = document.createElement('p');
            element.textContent = props.text;
            element.className = `mt-2 ${props.color || 'text-gray-600'}`;
            break;
        }
        case 'list': {
            element = document.createElement('div');
            const listTitle = document.createElement('h3');
            listTitle.textContent = props.title;
            listTitle.className = `font-semibold text-lg ${props.color || 'text-gray-900'}`;
            element.appendChild(listTitle);

            const listElementTag = props.listStyle === 'numbered' ? 'ol' : 'ul';
            const listClassName = props.listStyle === 'numbered' ? 'list-decimal' : 'list-disc';
            const listEl = document.createElement(listElementTag);
            listEl.className = `${listClassName} list-inside mt-2`;
            
            const items = Array.isArray(props.items) ? props.items : (props.items ? props.items.split(',') : []);
            items.forEach(itemText => {
                const li = document.createElement('li');
                li.textContent = itemText.trim();
                li.className = `${props.color || 'text-gray-700'} ${props.itemStyle || ''}`;
                listEl.appendChild(li);
            });
            element.appendChild(listEl);
            break;
        }
        case 'button': {
            element = document.createElement('button');
            element.textContent = props.text;
            element.className = `px-6 py-3 mt-4 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md ${props.style || 'bg-indigo-600 text-white'}`;
            if (props.onClick && dynamicOutputContainer) {
                element.addEventListener('click', async () => {
                    const originalText = element?.textContent;
                    if (element) {
                        element.textContent = 'Loading...';
                        (element as HTMLButtonElement).disabled = true;
                    }
                    await executeFluxCommands(props.onClick, dynamicOutputContainer as HTMLElement);
                    if (element) {
                        element.textContent = originalText;
                        (element as HTMLButtonElement).disabled = false;
                    }
                });
            }
            break;
        }
        case 'divider': {
            element = document.createElement('hr');
            element.className = `my-8 border-t-2 ${props.color || 'border-gray-200'}`;
            break;
        }
        case 'card': {
            element = document.createElement('div');
            element.className = `bg-white p-6 rounded-xl shadow-lg mt-4 ${props.style || ''}`;
            const cardTitle = document.createElement('h3');
            cardTitle.textContent = props.title;
            cardTitle.className = 'text-xl font-semibold text-gray-800';
            const cardText = document.createElement('p');
            cardText.textContent = props.text;
            cardText.className = 'mt-2 text-gray-600';
            element.appendChild(cardTitle);
            element.appendChild(cardText);
            break;
        }
        case 'alert': {
            element = document.createElement('div');
            let alertClasses = 'p-4 rounded-lg text-sm font-medium mt-4';
            switch(props.type) {
                case 'success': alertClasses += ' bg-green-100 text-green-700'; break;
                case 'warning': alertClasses += ' bg-yellow-100 text-yellow-700'; break;
                case 'error': alertClasses += ' bg-red-100 text-red-700'; break;
                default: alertClasses += ' bg-blue-100 text-blue-700'; break;
            }
            element.className = alertClasses;
            element.textContent = props.text || 'An alert message.';
            break;
        }
        case 'progress': {
            element = document.createElement('div');
            element.className = `w-full bg-gray-200 rounded-full h-2.5 mt-4 ${props.style || ''}`;
            const progressBar = document.createElement('div');
            const value = parseFloat(props.value) || 0;
            const max = parseFloat(props.max) || 100;
            const width = Math.min(100, (value / max) * 100);
            progressBar.className = `bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out`;
            progressBar.style.width = `${width}%`;
            element.appendChild(progressBar);
            if (props.label) {
                const label = document.createElement('p');
                label.textContent = `${props.label}: ${value}%`;
                label.className = `mt-2 text-sm text-gray-600`;
                targetContainer.appendChild(label);
            }
            break;
        }
        case 'link': {
            element = document.createElement('a');
            element.textContent = props.text;
            element.className = `text-indigo-600 hover:underline mt-2 inline-block cursor-pointer ${props.style || ''}`;
            if (props.url) {
                element.addEventListener('click', () => showIframeView(props.url));
            } else if (props.onClick && dynamicOutputContainer) {
                element.addEventListener('click', () => executeFluxCommands(props.onClick, dynamicOutputContainer as HTMLElement));
            }
            break;
        }
        case 'iframe': {
            if (props.url) {
                showIframeView(props.url);
            } else {
                showCustomAlert("Error: 'iframe' command requires a 'url' property.");
            }
            break;
        }
        case 'table': {
            element = document.createElement('div');
            const table = document.createElement('table');
            table.className = `w-full text-left border-collapse mt-4`;
            const thead = document.createElement('thead');
            thead.className = `bg-gray-200`;
            const headerRow = document.createElement('tr');
            props.headers.forEach((headerText: string) => {
                const th = document.createElement('th');
                th.className = `p-3 font-semibold text-sm text-gray-700 border-b-2 border-gray-300`;
                th.textContent = headerText;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            props.rows.forEach((rowData: string[]) => {
                const row = document.createElement('tr');
                row.className = `hover:bg-gray-100`;
                rowData.forEach(cellData => {
                    const td = document.createElement('td');
                    td.className = `p-3 text-sm text-gray-600 border-b border-gray-200`;
                    td.textContent = cellData;
                    row.appendChild(td);
                });
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            element.appendChild(table);
            break;
        }
        case 'carousel': {
            element = document.createElement('div');
            element.className = 'carousel-container my-4';
            const slidesContainer = document.createElement('div');
            slidesContainer.className = 'carousel-slides flex';
            props.images.forEach((url: string, index: number) => {
                const slide = document.createElement('div');
                slide.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
                const img = document.createElement('img');
                img.src = url;
                img.alt = `Carousel Image ${index + 1}`;
                slide.appendChild(img);
                slidesContainer.appendChild(slide);
            });
            element.appendChild(slidesContainer);
            // Navigation buttons
            const prevBtn = document.createElement('button');
            prevBtn.textContent = '❮';
            prevBtn.className = 'carousel-btn carousel-prev';
            const nextBtn = document.createElement('button');
            nextBtn.textContent = '❯';
            nextBtn.className = 'carousel-btn carousel-next';
            element.appendChild(prevBtn);
            element.appendChild(nextBtn);

            let currentSlide = 0;
            const slides = slidesContainer.querySelectorAll('.carousel-slide');
            const totalSlides = slides.length;
            const showSlide = (index: number) => {
                slides.forEach((slide, i) => {
                    slide.classList.toggle('active', i === index);
                });
            };
            prevBtn.addEventListener('click', () => {
                currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
                showSlide(currentSlide);
            });
            nextBtn.addEventListener('click', () => {
                currentSlide = (currentSlide + 1) % totalSlides;
                showSlide(currentSlide);
            });
            break;
        }
        case 'chart': {
            element = document.createElement('div');
            element.className = 'chart-container';
            const canvas = document.createElement('canvas');
            element.appendChild(canvas);
            new Chart(canvas.getContext('2d') as CanvasRenderingContext2D, {
                type: props.type,
                data: {
                    labels: props.labels,
                    datasets: [{
                        label: props.title,
                        data: props.data,
                        backgroundColor: props.backgroundColor || 'rgba(75, 192, 192, 0.6)',
                        borderColor: props.borderColor || 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                }
            });
            break;
        }
        case 'show': {
            const el = document.getElementById(props.id);
            if (el) el.classList.remove('hidden');
            return;
        }
        case 'hide': {
            const el = document.getElementById(props.id);
            if (el) el.classList.add('hidden');
            return;
        }
        case 'wait':
            await wait(parseFloat(props.seconds) || 0);
            return;
        case 'input': {
            element = document.createElement('input');
            element.type = "text";
            element.placeholder = props.placeholder || '';
            element.className = `w-full h-10 px-4 mt-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${props.style || ''}`;
            if (props.id) {
                element.id = props.id;
            }
            break;
        }
        case 'textarea': {
            element = document.createElement('textarea');
            element.placeholder = props.placeholder || '';
            element.className = `w-full h-32 px-4 py-2 mt-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y ${props.style || ''}`;
            if (props.id) {
                element.id = props.id;
            }
            break;
        }
        case 'form': {
            element = document.createElement('div');
            element.className = `mt-4 p-4 border rounded-lg`;
            break;
        }
        case 'submit': {
            element = document.createElement('button');
            element.textContent = props.text;
            element.className = `px-6 py-3 mt-4 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md ${props.style || 'bg-indigo-600 text-white'}`;
            if (props.formId && props.onClick && dynamicOutputContainer) {
                element.addEventListener('click', async () => {
                    const form = document.getElementById(props.formId);
                    if (form) {
                        const inputs = form.querySelectorAll('input, textarea');
                        const formData: { [key: string]: string } = {};
                        inputs.forEach(input => {
                            formData[input.id] = (input as HTMLInputElement).value;
                        });
                        state[props.formId] = formData;
                        const originalText = element?.textContent;
                        if (element) {
                            element.textContent = 'Loading...';
                            (element as HTMLButtonElement).disabled = true;
                        }
                        await executeFluxCommands(props.onClick, dynamicOutputContainer as HTMLElement);
                        if (element) {
                            element.textContent = originalText;
                            (element as HTMLButtonElement).disabled = false;
                        }
                    }
                });
            }
            break;
        }
        case 'store': {
            const userId = (window as any).userId;
            if (userId && (window as any).db) {
                const docRef = doc(getFirestore(), "flux-data", userId);
                await setDoc(docRef, { [props.id]: props.value }, { merge: true });
                console.log(`Stored data for '${props.id}'`);
            } else {
                console.warn("Firebase not initialized or user not authenticated. Cannot store data.");
            }
            return;
        }
        case 'load': {
            const userId = (window as any).userId;
            if (userId && (window as any).db) {
                const docRef = doc(getFirestore(), "flux-data", userId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    state[props.id] = docSnap.data()?.[props.id];
                    console.log(`Loaded data for '${props.id}':`, state[props.id]);
                } else {
                    console.log(`No data found for '${props.id}'.`);
                }
            } else {
                console.warn("Firebase not initialized or user not authenticated. Cannot load data.");
            }
            return;
        }

        // New UI Components
        case 'badge': {
            element = document.createElement('span');
            element.textContent = props.text;
            element.className = `inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium ${props.color || 'bg-gray-100 text-gray-800'}`;
            break;
        }
        case 'circular-progress': {
            const size = parseFloat(props.size) || 100;
            const value = parseFloat(props.value) || 0;
            const max = parseFloat(props.max) || 100;
            const color = props.color || 'text-indigo-600';
            const radius = 45; // Fixed radius for the SVG
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (value / max) * circumference;

            element = document.createElement('div');
            element.className = 'circular-progress';
            element.style.width = `${size}px`;
            element.style.height = `${size}px`;

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', `${size}`);
            svg.setAttribute('height', `${size}`);
            svg.setAttribute('viewBox', `0 0 100 100`);

            const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            backgroundCircle.setAttribute('cx', '50');
            backgroundCircle.setAttribute('cy', '50');
            backgroundCircle.setAttribute('r', radius.toString());
            backgroundCircle.setAttribute('fill', 'none');
            backgroundCircle.setAttribute('stroke', '#e5e7eb');
            backgroundCircle.setAttribute('stroke-width', '10');

            const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            progressCircle.setAttribute('cx', '50');
            progressCircle.setAttribute('cy', '50');
            progressCircle.setAttribute('r', radius.toString());
            progressCircle.setAttribute('fill', 'none');
            progressCircle.setAttribute('stroke', color.startsWith('text-') ? `var(--${color.slice(5)})` : color); // Map tailwind class to CSS variable
            progressCircle.setAttribute('stroke-width', '10');
            progressCircle.setAttribute('stroke-linecap', 'round');
            progressCircle.setAttribute('stroke-dasharray', circumference.toString());
            progressCircle.style.strokeDashoffset = offset.toString();

            const textEl = document.createElement('span');
            textEl.textContent = `${Math.round(value)}%`;
            textEl.className = `absolute font-bold text-lg ${color}`;

            svg.appendChild(backgroundCircle);
            svg.appendChild(progressCircle);
            element.appendChild(svg);
            element.appendChild(textEl);
            break;
        }
        case 'toggle': {
            element = document.createElement('div');
            element.className = 'flex items-center mt-4';
            
            const label = document.createElement('label');
            label.htmlFor = props.id;
            label.textContent = props.label;
            label.className = 'text-gray-700 mr-3';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = props.id;
            checkbox.className = 'h-5 w-10 rounded-full appearance-none bg-gray-300 checked:bg-indigo-600 transition-colors duration-200 ease-in-out cursor-pointer relative after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:bg-white after:rounded-full after:transition-transform after:duration-200 after:ease-in-out checked:after:translate-x-5';

            checkbox.addEventListener('change', () => {
                state[props.id] = checkbox.checked;
            });

            element.appendChild(label);
            element.appendChild(checkbox);
            break;
        }
        case 'radio-group': {
            element = document.createElement('div');
            element.className = 'mt-4';
            const name = props.name;
            (props.options as string[]).forEach(option => {
                const radioWrapper = document.createElement('div');
                radioWrapper.className = 'flex items-center';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.id = `${name}-${option}`;
                radio.name = name;
                radio.value = option;
                radio.className = 'h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500';

                const label = document.createElement('label');
                label.htmlFor = `${name}-${option}`;
                label.textContent = option;
                label.className = 'ml-2 text-gray-700';

                radio.addEventListener('change', () => {
                    if (radio.checked) {
                        state[name] = radio.value;
                    }
                });

                radioWrapper.appendChild(radio);
                radioWrapper.appendChild(label);
                element.appendChild(radioWrapper);
            });
            break;
        }
        case 'checkbox-group': {
            element = document.createElement('div');
            element.className = 'mt-4';
            const name = props.name;
            state[name] = []; // Initialize state for this checkbox group
            (props.options as string[]).forEach(option => {
                const checkboxWrapper = document.createElement('div');
                checkboxWrapper.className = 'flex items-center';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `${name}-${option}`;
                checkbox.value = option;
                checkbox.className = 'h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500';

                const label = document.createElement('label');
                label.htmlFor = `${name}-${option}`;
                label.textContent = option;
                label.className = 'ml-2 text-gray-700';

                checkbox.addEventListener('change', () => {
                    const value = checkbox.value;
                    if (checkbox.checked) {
                        if (!state[name].includes(value)) {
                            state[name].push(value);
                        }
                    } else {
                        state[name] = state[name].filter((v: string) => v !== value);
                    }
                });

                checkboxWrapper.appendChild(checkbox);
                checkboxWrapper.appendChild(label);
                element.appendChild(checkboxWrapper);
            });
            break;
        }
        case 'dropdown': {
            element = document.createElement('div');
            element.className = 'mt-4';
            
            const label = document.createElement('label');
            label.htmlFor = props.id;
            label.textContent = props.label;
            label.className = 'block text-sm font-medium text-gray-700';
            
            const select = document.createElement('select');
            select.id = props.id;
            select.className = 'mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md';

            (props.options as string[]).forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option;
                optionEl.textContent = option;
                select.appendChild(optionEl);
            });

            select.addEventListener('change', () => {
                state[props.id] = select.value;
            });

            element.appendChild(label);
            element.appendChild(select);
            break;
        }
        case 'modal': {
            const modalId = props.id;
            if (activeModals[modalId]) {
                activeModals[modalId].classList.remove('hidden');
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'flux-modal-overlay';
            overlay.classList.add('hidden'); // Initially hidden

            const content = document.createElement('div');
            content.className = 'flux-modal-content';

            const titleEl = document.createElement('h3');
            titleEl.textContent = props.title;
            titleEl.className = 'text-2xl font-bold text-gray-900 mb-2';

            const textEl = document.createElement('p');
            textEl.textContent = props.text;
            textEl.className = 'text-gray-600';

            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.className = 'mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition';
            closeBtn.addEventListener('click', () => {
                overlay.classList.add('hidden');
            });

            content.appendChild(titleEl);
            content.appendChild(textEl);
            content.appendChild(closeBtn);
            overlay.appendChild(content);

            document.body.appendChild(overlay);
            activeModals[modalId] = overlay;
            return;
        }
        case 'button.modal': {
            element = document.createElement('button');
            element.textContent = props.text;
            element.className = `px-6 py-3 mt-4 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md ${props.style || 'bg-indigo-600 text-white'}`;
            element.addEventListener('click', () => {
                const modal = activeModals[props.modalId];
                if (modal) {
                    modal.classList.remove('hidden');
                } else {
                    showCustomAlert(`Error: Modal with id '${props.modalId}' not found.`);
                }
            });
            break;
        }

        default:
            console.warn(`Unknown command type: ${type}`);
            return;
    }

    if (element) {
        if (props.id) {
            element.id = props.id;
        }
        targetContainer.appendChild(element);
    }
};

/**
 * Recursively processes a list of commands, including nested blocks like loops.
 * @param commands The array of command objects.
 * @param targetContainer The DOM element to append the output to.
 */
export const executeFluxCommands = async (commands: any[], targetContainer: HTMLElement) => {
    for (const command of commands) {
        if (command.type === 'loop' && Array.isArray(command.commands)) {
            const count = parseInt(command.props.count, 10);
            for (let i = 0; i < count; i++) {
                state.loopIndex = i; // Provide loop index to the state
                await executeFluxCommands(command.commands, targetContainer);
            }
        } else {
            await processCommand(command, targetContainer);
        }
    }
};

// Expose functions to the global scope for the HTML file
(window as any).initializeFluxCommands = initializeFluxCommands;
(window as any).processCommand = processCommand;
(window as any).executeFluxCommands = executeFluxCommands;
(window as any).showCustomAlert = showCustomAlert;
(window as any).showIframeView = showIframeView;
(window as any).showMainAppView = showMainAppView;
(window as any).state = state;
