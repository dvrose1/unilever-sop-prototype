// State management
const state = {
    selectedWorkspace: null,
    selectedTemplate: null,
    selectedBrand: null,
    selectedChannels: [],
    currentStep: 'workspace-selection',
    generatedSlides: [],
    completedCombos: new Set() // Tracks completed brand-channel combinations as "brand:channel"
};

// Available brands and channels
const brands = ['dove', 'tresemme', 'vaseline', 'nexxus', 'shea-moisture'];
const channels = ['national', 'social', 'paid-search', 'mikmak'];

// Template definitions
const templates = {
    'brand-slides': {
        name: 'Brand Performance Slides',
        needsBrand: true,
        needsChannel: true,
        slidesPerCombo: 3,
        slides: [
            { name: 'Brand Performance Overview', icon: '📊', confidence: 95, description: 'ROI trends and key metrics' },
            { name: 'Key Insights & Recommendations', icon: '💡', confidence: 92, description: 'Performance drivers and actions' },
            { name: 'Look Ahead Recommendations', icon: '🎯', confidence: 88, description: 'Strategic priorities' }
        ]
    },
    'exec-summary': {
        name: 'BU Executive Summary',
        needsBrand: false,
        needsChannel: false,
        slides: [
            { name: 'Executive Overview', icon: '📈', confidence: 96, description: 'Key business metrics' },
            { name: 'Performance Highlights', icon: '⭐', confidence: 94, description: 'Top performing areas' },
            { name: 'Areas of Focus', icon: '🎯', confidence: 91, description: 'Priority initiatives' },
            { name: 'Financial Summary', icon: '💰', confidence: 93, description: 'Budget and spend' },
            { name: 'Strategic Recommendations', icon: '🔮', confidence: 89, description: 'Forward-looking actions' }
        ]
    },
    'sos-som': {
        name: 'SoS/SoM Update',
        needsBrand: false,
        needsChannel: false,
        slides: [
            { name: 'Share of Shelf Overview', icon: '📊', confidence: 94, description: 'Retailer presence metrics' },
            { name: 'Share of Market Trends', icon: '📈', confidence: 93, description: 'Market position analysis' },
            { name: 'Competitive Landscape', icon: '🏆', confidence: 90, description: 'Competitor comparison' },
            { name: 'Distribution Analysis', icon: '🗺️', confidence: 92, description: 'Geographic breakdown' }
        ]
    },
    'post-meeting': {
        name: 'Post-Meeting Actions',
        needsBrand: false,
        needsChannel: false,
        slides: [
            { name: 'Action Items Summary', icon: '✓', confidence: 97, description: 'Tasks and owners' },
            { name: 'Key Decisions', icon: '🎯', confidence: 96, description: 'Commitments made' },
            { name: 'Open Questions', icon: '❓', confidence: 94, description: 'Items for follow-up' },
            { name: 'Next Steps Timeline', icon: '📅', confidence: 95, description: 'Delivery schedule' }
        ]
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeProgressTracker();
});

function initializeEventListeners() {
    // Workspace selection
    const workspaceCards = document.querySelectorAll('.workspace-card');
    workspaceCards.forEach(card => {
        card.addEventListener('click', () => {
            selectWorkspace(card.dataset.workspace);
        });
    });

    // Template selection
    const templateCards = document.querySelectorAll('.template-card');
    templateCards.forEach(card => {
        card.addEventListener('click', () => {
            selectTemplate(card.dataset.template);
        });
    });

    // Brand selection
    const brandCards = document.querySelectorAll('.brand-card');
    brandCards.forEach(card => {
        card.addEventListener('click', () => {
            selectBrand(card.dataset.brand);
        });
    });

    // Channel checkboxes
    const channelCards = document.querySelectorAll('.channel-card');
    channelCards.forEach(card => {
        const checkbox = card.querySelector('.channel-checkbox');
        const label = card.querySelector('label');

        card.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }

            // Handle "All Channels" special case
            if (card.id === 'select-all-channels') {
                const allChannelCheckboxes = document.querySelectorAll('.channel-checkbox:not(#channel-all)');
                allChannelCheckboxes.forEach(cb => {
                    cb.checked = checkbox.checked;
                });
            } else {
                // If user unchecks any individual channel, uncheck "All"
                const allCheckbox = document.getElementById('channel-all');
                if (allCheckbox && !checkbox.checked) {
                    allCheckbox.checked = false;
                }
            }

            updateSelectedChannels();
        });

        checkbox.addEventListener('change', updateSelectedChannels);
    });

    // Continue to preview button (for multi-channel)
    document.getElementById('continue-to-preview')?.addEventListener('click', () => {
        if (state.selectedChannels.length > 0) {
            showBrandPreview();
        } else {
            alert('Please select at least one channel');
        }
    });

    // Breadcrumb navigation
    document.querySelectorAll('[id^="breadcrumb-template"]').forEach(btn => {
        btn.addEventListener('click', () => goToStep('step-template'));
    });
    document.querySelectorAll('[id^="breadcrumb-brand"]').forEach(btn => {
        btn.addEventListener('click', () => goToStep('step-brand'));
    });
    document.getElementById('breadcrumb-channel')?.addEventListener('click', () => goToStep('step-channel'));
    document.getElementById('breadcrumb-template-other')?.addEventListener('click', () => goToStep('step-template'));

    // Back button
    document.getElementById('back-to-workspace')?.addEventListener('click', () => {
        showExtensionScreen('workspace-selection');
        state.selectedTemplate = null;
        state.selectedBrand = null;
        state.selectedChannels = [];
    });

    // Generate slides buttons
    document.getElementById('generate-slides-btn')?.addEventListener('click', generateSlides);
    document.getElementById('generate-other-slides-btn')?.addEventListener('click', generateSlides);

    // Success screen buttons
    document.getElementById('create-more-btn')?.addEventListener('click', () => {
        goToStep('step-template');
    });
    document.getElementById('done-btn')?.addEventListener('click', () => {
        goToStep('step-template');
    });

    // Query bar
    const queryInput = document.getElementById('query-input');
    const querySendBtn = document.getElementById('query-send-btn');
    const querySuggestions = document.getElementById('query-suggestions');
    const queryExpanded = document.getElementById('query-expanded');

    queryInput?.addEventListener('focus', () => {
        querySuggestions?.classList.add('active');
    });

    queryInput?.addEventListener('blur', () => {
        setTimeout(() => {
            querySuggestions?.classList.remove('active');
        }, 200);
    });

    queryInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleQuery(queryInput.value);
        }
    });

    querySendBtn?.addEventListener('click', () => {
        handleQuery(queryInput.value);
    });

    // Query suggestions
    const suggestionButtons = document.querySelectorAll('.query-suggestion');
    suggestionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            handleQuery(btn.textContent);
        });
    });

    // Insight buttons
    const insightButtons = document.querySelectorAll('.insight-btn');
    insightButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleAddToSlide(e.target);
        });
    });

    // Add to slide from query response
    document.getElementById('add-insight-btn')?.addEventListener('click', function() {
        handleAddToSlide(this);
    });

    // Query close button
    document.getElementById('query-close-btn')?.addEventListener('click', () => {
        const queryExpanded = document.getElementById('query-expanded');
        queryExpanded?.classList.remove('active');
    });

    // Query history button
    document.getElementById('query-history-btn')?.addEventListener('click', () => {
        // In production, this would open Assemble chat history
        showNotification('Opening chat history in Assemble...');
        // Simulate opening external link
        setTimeout(() => {
            alert('In production, this would open your conversation history in Assemble');
        }, 500);
    });
}

function selectWorkspace(workspace) {
    state.selectedWorkspace = workspace;
    showExtensionScreen('main-screen');
    goToStep('step-template');
}

function selectTemplate(template) {
    state.selectedTemplate = template;
    state.selectedBrand = null;
    state.selectedChannels = [];

    const templateDef = templates[template];

    if (templateDef.needsBrand) {
        goToStep('step-brand');
    } else {
        showOtherTemplatePreview();
    }
}

function selectBrand(brand) {
    state.selectedBrand = brand;
    state.selectedChannels = [];

    // Clear channel checkboxes
    document.querySelectorAll('.channel-checkbox').forEach(cb => cb.checked = false);

    const brandName = brand === 'all' ? 'All Brands' : capitalizeWords(brand.replace(/-/g, ' '));
    document.getElementById('selected-brand-name').textContent = brandName;

    goToStep('step-channel');
}

function updateSelectedChannels() {
    state.selectedChannels = [];
    document.querySelectorAll('.channel-checkbox:checked').forEach(cb => {
        const channel = cb.parentElement.dataset.channel;
        if (channel && channel !== 'undefined') { // Skip the "All" option itself
            state.selectedChannels.push(channel);
        }
    });
}

function showBrandPreview() {
    const templateDef = templates[state.selectedTemplate];
    const brandName = state.selectedBrand === 'all' ? 'All Brands' : capitalizeWords(state.selectedBrand.replace(/-/g, ' '));

    // Build preview text
    const channelNames = state.selectedChannels.map(c =>
        capitalizeWords(c.replace(/-/g, ' '))
    ).join(', ');

    document.getElementById('preview-selections').textContent =
        `${brandName} - ${channelNames}`;

    // Calculate total slides
    const totalSlides = templateDef.slidesPerCombo * state.selectedChannels.length;
    document.getElementById('total-slide-count').textContent = totalSlides;

    // Generate preview list
    const previewList = document.getElementById('brand-preview-list');
    previewList.innerHTML = '';

    state.selectedChannels.forEach(channel => {
        const channelName = capitalizeWords(channel.replace(/-/g, ' '));

        templateDef.slides.forEach(slide => {
            const item = document.createElement('div');
            item.className = 'slide-preview-item';
            item.innerHTML = `
                <div class="slide-checkbox">
                    <input type="checkbox" checked>
                </div>
                <div class="slide-preview-thumbnail">${slide.icon}</div>
                <div class="slide-preview-info">
                    <h4>${slide.name}</h4>
                    <p>${brandName} - ${channelName}</p>
                    <div class="confidence-badge">
                        <span class="confidence-dot"></span>
                        ${slide.confidence}% Confidence
                    </div>
                </div>
            `;
            previewList.appendChild(item);
        });
    });

    // Update generate button
    const uncheckedCount = document.querySelectorAll('.slide-preview-item input[type="checkbox"]:checked').length;
    document.getElementById('generate-btn-text').textContent = `Generate ${uncheckedCount} Slides`;

    goToStep('step-preview');
}


function showOtherTemplatePreview() {
    const templateDef = templates[state.selectedTemplate];

    document.getElementById('preview-other-description').textContent =
        `${templateDef.name} slides will be generated`;
    document.getElementById('other-slide-count').textContent = templateDef.slides.length;

    // Generate preview list
    const previewList = document.getElementById('other-preview-list');
    previewList.innerHTML = '';

    templateDef.slides.forEach(slide => {
        const item = document.createElement('div');
        item.className = 'slide-preview-item';
        item.innerHTML = `
            <div class="slide-checkbox">
                <input type="checkbox" checked>
            </div>
            <div class="slide-preview-thumbnail">${slide.icon}</div>
            <div class="slide-preview-info">
                <h4>${slide.name}</h4>
                <p>${slide.description}</p>
                <div class="confidence-badge">
                    <span class="confidence-dot"></span>
                    ${slide.confidence}% Confidence
                </div>
            </div>
        `;
        previewList.appendChild(item);
    });

    goToStep('step-preview-other');
}

function generateSlides() {
    goToStep('step-generating');

    // Simulate progress
    const progressItems = document.querySelectorAll('.progress-item');
    let currentProgress = 2;

    const progressInterval = setInterval(() => {
        if (currentProgress < progressItems.length) {
            progressItems[currentProgress].classList.remove('active');
            progressItems[currentProgress].classList.add('completed');

            currentProgress++;
            if (currentProgress < progressItems.length) {
                progressItems[currentProgress].classList.add('active');
            }
        } else {
            clearInterval(progressInterval);
            setTimeout(() => {
                showGeneratedSlides();
            }, 500);
        }
    }, 1200);
}

function showGeneratedSlides() {
    // Count checked slides
    const checkedSlides = document.querySelectorAll('.slide-preview-item input[type="checkbox"]:checked');
    const slideCount = checkedSlides.length;

    // Update success message
    document.getElementById('success-count').textContent = `${slideCount} Slides`;

    const templateDef = templates[state.selectedTemplate];
    if (templateDef.needsBrand && templateDef.needsChannel) {
        const brandName = capitalizeWords(state.selectedBrand.replace(/-/g, ' '));

        const channelNames = state.selectedChannels.map(c =>
            capitalizeWords(c.replace(/-/g, ' '))
        ).join(', ');
        document.getElementById('success-description').textContent =
            `${brandName} - ${channelNames}`;

        // Mark brand-channel combinations as completed
        state.selectedChannels.forEach(channel => {
            state.completedCombos.add(`${state.selectedBrand}:${channel}`);
        });

        // Update progress tracker
        updateProgressTracker();
    } else {
        document.getElementById('success-description').textContent = templateDef.name;
    }

    // Add slides to PPT sidebar and canvas
    addSlidesToPresentation(slideCount);

    // Show success screen
    goToStep('step-success');
}

function addSlidesToPresentation(count) {
    const slideList = document.getElementById('slide-list');
    const currentSlides = slideList.querySelectorAll('.ppt-slide-thumb').length;

    // Add new slide thumbnails
    for (let i = 0; i < count; i++) {
        const slideNum = currentSlides + i + 1;
        const thumb = document.createElement('div');
        thumb.className = 'ppt-slide-thumb';
        thumb.dataset.slide = slideNum;

        const templateDef = templates[state.selectedTemplate];
        const slideIndex = i % templateDef.slides.length;
        const slideDef = templateDef.slides[slideIndex];

        thumb.innerHTML = `
            <div class="slide-number">${slideNum}</div>
            <div class="slide-preview">
                <div class="slide-preview-title">${slideDef.name}</div>
            </div>
        `;

        thumb.addEventListener('click', () => showSlideInCanvas(slideNum, slideDef));
        slideList.appendChild(thumb);
    }

    // Show first generated slide
    if (count > 0) {
        const firstNewSlide = currentSlides + 1;
        const templateDef = templates[state.selectedTemplate];
        showSlideInCanvas(firstNewSlide, templateDef.slides[0]);

        // Update active state
        document.querySelectorAll('.ppt-slide-thumb').forEach(t => t.classList.remove('active'));
        document.querySelector(`.ppt-slide-thumb[data-slide="${firstNewSlide}"]`)?.classList.add('active');
    }
}

function showSlideInCanvas(slideNum, slideDef) {
    const canvas = document.getElementById('current-slide');
    const brandName = state.selectedBrand ? capitalizeWords(state.selectedBrand.replace(/-/g, ' ')) : 'Brand';
    const channelName = state.selectedChannels[0] ? capitalizeWords(state.selectedChannels[0].replace(/-/g, ' ')) : 'Channel';

    canvas.innerHTML = `
        <div class="slide-content brand-slide">
            <div class="slide-brand-header">
                <div class="slide-brand-title">${brandName} - ${channelName}</div>
                <div class="slide-brand-subtitle">${slideDef.name}</div>
            </div>
            <div class="slide-chart-area">
                <div class="slide-chart">
                    <div class="slide-chart-title">Performance Trend</div>
                    <div class="chart-placeholder">📊</div>
                </div>
                <div class="slide-insights">
                    <div class="slide-insights-title">KEY INSIGHTS</div>
                    <div class="slide-insight-item">ROI improved 15% YoY driven by optimized targeting</div>
                    <div class="slide-insight-item">Channel shows consistent performance above benchmark</div>
                    <div class="slide-insight-item">Recommend 20% budget increase for Q2</div>
                </div>
            </div>
        </div>
    `;

    // Update active thumbnail
    document.querySelectorAll('.ppt-slide-thumb').forEach(t => t.classList.remove('active'));
    document.querySelector(`.ppt-slide-thumb[data-slide="${slideNum}"]`)?.classList.add('active');
}

function showExtensionScreen(screenId) {
    document.querySelectorAll('.extension-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId)?.classList.add('active');
}

function goToStep(stepId) {
    document.querySelectorAll('.step-content').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(stepId)?.classList.add('active');

    // Reset progress items when going back
    if (stepId !== 'step-generating') {
        document.querySelectorAll('.progress-item').forEach((item, index) => {
            item.classList.remove('active', 'completed');
            if (index < 2) {
                item.classList.add('completed');
            }
        });
    }
}

function handleQuery(query) {
    if (!query || query.trim() === '') return;

    const queryInput = document.getElementById('query-input');
    const queryExpanded = document.getElementById('query-expanded');
    const querySuggestions = document.getElementById('query-suggestions');
    const responseContent = document.getElementById('response-content');

    // Hide suggestions, show expanded response
    querySuggestions?.classList.remove('active');
    queryExpanded.classList.add('active');

    queryInput.value = '';
    responseContent.innerHTML = '<div class="small-spinner"></div>';

    setTimeout(() => {
        const response = generateQueryResponse(query);
        responseContent.innerHTML = response;
    }, 1000);
}

function generateQueryResponse(query) {
    const responses = {
        'default': `Based on recent data, ${state.selectedBrand || 'your brand'} shows strong performance. ROI improved 15% month-over-month with particular strength in digital channels. Consider reallocating budget from underperforming traditional channels.`,
        'performance': `${capitalizeWords((state.selectedBrand || 'dove').replace(/-/g, ' '))} performance shows +12% YoY ROI improvement. Key drivers include optimized creative and improved targeting. However, conversion rates declined 3% recently, suggesting potential creative fatigue.`,
        'compare': `Channel comparison shows Social outperforming National by 25% in ROI efficiency, but National delivers 3x higher revenue. Paid Search has highest ROI at 2.4x but limited scale. Maintain National while scaling Social and Paid Search.`
    };

    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('performance') || lowerQuery.includes('drove')) {
        return responses.performance;
    } else if (lowerQuery.includes('compare') || lowerQuery.includes('roi')) {
        return responses.compare;
    }
    return responses.default;
}

function handleAddToSlide(button) {
    button.textContent = '✓ Added';
    button.style.background = '#e8f5e9';
    button.style.color = '#107c10';
    button.disabled = true;

    showNotification('Insight added to current slide');

    setTimeout(() => {
        button.textContent = '+ Add to Slide';
        button.style.background = '';
        button.style.color = '';
        button.disabled = false;
    }, 3000);
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: #107c10;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-size: 14px;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 300);
    }, 3000);
}

function capitalizeWords(str) {
    return str.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

// Progress Tracker Functions
function initializeProgressTracker() {
    updateProgressTracker();

    // Toggle main progress tracker expand/collapse
    document.getElementById('main-progress-toggle')?.addEventListener('click', () => {
        const details = document.getElementById('all-progress-details');
        const expandBtn = document.getElementById('main-progress-expand-btn');

        if (details.style.display === 'none') {
            details.style.display = 'flex';
            expandBtn.classList.add('expanded');
        } else {
            details.style.display = 'none';
            expandBtn.classList.remove('expanded');
        }
    });
}

function updateProgressTracker() {
    const progressContainer = document.getElementById('all-progress-details');
    progressContainer.innerHTML = '';

    // Build progress for each template
    Object.keys(templates).forEach(templateKey => {
        const template = templates[templateKey];
        const item = document.createElement('div');

        if (template.needsBrand && template.needsChannel) {
            // Brand Performance Slides - expandable with brand breakdown
            const totalCombos = brands.length * channels.length;
            const completedCount = state.completedCombos.size;

            item.className = 'progress-item';
            item.innerHTML = `
                <div class="progress-item-info">
                    <div class="progress-item-icon">📊</div>
                    <div class="progress-item-text">${template.name}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="progress-item-status">${completedCount}/${totalCombos}</div>
                    <button class="progress-item-expand-btn" data-template="${templateKey}">▼</button>
                </div>
            `;

            // Create sub-items container
            const subItems = document.createElement('div');
            subItems.className = 'progress-sub-items';
            subItems.id = `sub-items-${templateKey}`;

            brands.forEach(brand => {
                const brandName = capitalizeWords(brand.replace(/-/g, ' '));
                const completedChannels = channels.filter(channel =>
                    state.completedCombos.has(`${brand}:${channel}`)
                ).length;

                const subItem = document.createElement('div');
                subItem.className = `progress-sub-item ${completedChannels === channels.length ? 'completed' : ''}`;
                subItem.innerHTML = `
                    <div class="progress-item-info">
                        <div class="progress-item-icon" style="width: 16px; height: 16px; font-size: 10px;">${completedChannels === channels.length ? '✓' : brand.charAt(0).toUpperCase()}</div>
                        <div class="progress-item-text">${brandName}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="progress-item-status" style="font-size: 10px;">${completedChannels}/${channels.length}</div>
                        <button class="progress-item-go-btn" style="padding: 2px 8px; font-size: 10px;" data-brand="${brand}">Go</button>
                    </div>
                `;

                // Add click handler for Go button
                const goBtn = subItem.querySelector('.progress-item-go-btn');
                goBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    jumpToBrand(brand);
                });

                subItems.appendChild(subItem);
            });

            // Add expand/collapse handler
            const expandBtn = item.querySelector('.progress-item-expand-btn');
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                subItems.classList.toggle('expanded');
                expandBtn.classList.toggle('expanded');
            });

            progressContainer.appendChild(item);
            progressContainer.appendChild(subItems);
        } else {
            // Other templates - simple complete/incomplete status
            const isComplete = false; // TODO: track completion for these templates

            item.className = `progress-item ${isComplete ? 'completed' : ''}`;
            item.innerHTML = `
                <div class="progress-item-info">
                    <div class="progress-item-icon">${template.slides[0].icon}</div>
                    <div class="progress-item-text">${template.name}</div>
                </div>
                <div class="progress-item-status">${isComplete ? 'Complete' : 'Not Started'}</div>
            `;

            progressContainer.appendChild(item);
        }
    });
}

function jumpToBrand(brand) {
    // Pre-select the brand and go to channel selection
    state.selectedTemplate = 'brand-slides';
    selectBrand(brand);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const queryExpanded = document.getElementById('query-expanded');
        if (queryExpanded?.classList.contains('active')) {
            queryExpanded.classList.remove('active');
        }
    }
});
