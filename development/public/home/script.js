import { Auth, Database, FirebaseAuth, FirebaseDB, } from '/common/scripts/fbinit.js';
import { getVariable, setVariable, } from '/common/scripts/variables.js';
import * as CommonJS from '/common/scripts/common.js';

// holds user messages
let UserMessages = {};

// DOM nodes to interact with JS.
const FirstNamePh = document.getElementById('ph-font-your-name');
const LinkAnchor = document.getElementById('ph-a-your-link');
const ShareButton = document.getElementById('btn-share-link');
const MessagesDiv = document.getElementById('ph-div-your-messages');
const SplashScreen = document.getElementById('SplashScreen-main');

// count of messages + 1; used to update MessagesDiv grid template
let MESG_COUNT = 0;

const updateGridTemplate = function() {
    if (window.innerWidth > 460) {
        // if only 1 msg and placeholder present
        if (MESG_COUNT <= 2) {
            MessagesDiv.style.gridTemplateColumns = '100%';
            MessagesDiv.parentNode.style.maxWidth = '460px';
        } else {
            MessagesDiv.style.gridTemplateColumns = '50% 50%';
            MessagesDiv.parentNode.style.maxWidth = '1080px';
        }
    } else {
        MessagesDiv.style.gridTemplateColumns = '100%';
        MessagesDiv.parentNode.style.maxWidth = '1080px';
    }
}

// load messages to UI
const loadMessagesToUI = function() {

    // if UserMessages is empty, just return
    if(!UserMessages || UserMessages == {}) return;

    MESG_COUNT = Object.keys(UserMessages).length;
    updateGridTemplate();

    // if there are 1 or less keys, render the placeholder div
    if (MESG_COUNT <= 1) {
        MessagesDiv.innerHTML = (
              '<div class="vert-layout message placeholder noselect" id="ph-div-msg-0000">'
            +     '<h4 style="'
            +         'margin: auto;'
            +         'color: #666;'
            +         'text-align: center; ">'
            +         'You currently have no messages.'
            +     '</h4>'
            + '</div>'
        );
        return;
    }

    // clear the messages div
    MessagesDiv.innerHTML = '';

    // add the sanitized messages in HTML to the div
    for (const key in UserMessages) {
        if (key === 'placeholder-key') continue;
        MessagesDiv.innerHTML = HtmlSanitizer.SanitizeHtml(
              `<div class="message placeholder" id="ph-div-msg-${key}">`
            +     '<div class="noselect del">×</div>'
            +     '<div class="markdown" style="'
            +         'margin: 0;'
            +         'padding: 0;'
            +         'width: 100%; ">'
            +         CommonJS.decode(UserMessages[key].message)
            +     '</div>'
            +     '<div class="noselect time">'
            +         CommonJS.decode(UserMessages[key].time)
            +     '</div>'
            + '</div>'
        ) + MessagesDiv.innerHTML;
    }
}

const main = function() {

    // allows resetting UserData of a user
    if (CommonJS.getURLQueryFieldValue('reset') === 'true') {
        localStorage.removeItem('Auth.UID');
        location.href = '/register';
        return;
    }

    // if UID is absent in local storage, load /register
    if (!localStorage.getItem('Auth.UID')
    &&  !location.href.includes('/msg')) {
        location.href = '/msg';
        return;
    }

    // html sanitizer configuration - additional tags and attributes
    HtmlSanitizer.AllowedTags['h'] = true;
    HtmlSanitizer.AllowedAttributes['alt'] = true;
    HtmlSanitizer.AllowedAttributes['id'] = true;
    HtmlSanitizer.AllowedAttributes['class'] = true;
    HtmlSanitizer.AllowedAttributes['download'] = true;
    HtmlSanitizer.AllowedSchemas.push('mailto:');
    HtmlSanitizer.AllowedCssStyles['width'] = true;
    HtmlSanitizer.AllowedCssStyles['height'] = true;
    HtmlSanitizer.AllowedCssStyles['min-width'] = true;
    HtmlSanitizer.AllowedCssStyles['min-height'] = true;
    HtmlSanitizer.AllowedCssStyles['max-width'] = true;
    HtmlSanitizer.AllowedCssStyles['max-height'] = true;
    HtmlSanitizer.AllowedCssStyles['padding'] = true;
    HtmlSanitizer.AllowedCssStyles['margin'] = true;
    HtmlSanitizer.AllowedCssStyles['border'] = true;
    HtmlSanitizer.AllowedCssStyles['border-radius'] = true;
    HtmlSanitizer.AllowedCssStyles['display'] = true;
    HtmlSanitizer.AllowedCssStyles['overflow'] = true;
    HtmlSanitizer.AllowedCssStyles['transform'] = true;
    HtmlSanitizer.AllowedCssStyles['background'] = true;

    // on authentication state changed, i.e signed in or out
    FirebaseAuth.onAuthStateChanged(Auth, (user) => {

        // signed out / not signed in
        if (!user) {
            console.error('home: user not signed in');
            localStorage.removeItem('Auth.UID');
            // open login page if not already on login page
            if (!location.href.includes('/register')) location.href = '/register';
            return;
        }

        // signed in, store UID in local storage
        localStorage.setItem('Auth.UID', user.uid);

        setVariable('USER_ID', user.uid);
        setVariable('USER_ROOT', user.uid);
        setVariable('MSG_ROOT', user.uid);

        // change link URL id to UID
        LinkAnchor.href = `/msg?id=${getVariable('USER_ID')}`;

        /* download user data from database - includes name and a message
         * also, set FirstNamePh.innerHTML to user firstname
         */
        FirebaseDB.onValue(FirebaseDB.ref(Database, getVariable('USER_ROOT')), (snapshot) => {
            // snapshot doesn't exist
            if (!snapshot.exists()) {
                alert('Oops!\Your profile couldn\'t be found. You\'ll need to create a new link.');
                location.href = '/';
                return;
            }
            setVariable('UserData', snapshot.val());
            // sanitizes text to deactivate HTML tags
            FirstNamePh.innerHTML = CommonJS.decode(getVariable('UserData').name.firstname).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }, (error) => {
            alert('An error occurred.\n' + error);
            console.error(error);
        });

        // listen for messages recieved, load them into the UI and hide the SplashScreen
        FirebaseDB.onValue(FirebaseDB.ref(Database, getVariable('MSG_ROOT')), (snapshot) => {
            UserMessages = snapshot.val();
            loadMessagesToUI();
            if (SplashScreen.style.visibility !== 'hidden') {
                SplashScreen.style.visibility = 'hidden';
            }
        }, (error) => {
            alert('An error occurred.\n' + error);
            console.error(error);
        });
    });

    window.onresize = () => updateGridTemplate();
    updateGridTemplate();

    // onclick event
    document.body.onclick = (event) => {
        if (event.target.className.includes('del')) {
            const pushkey = event.target.parentNode.id.replace(/ph-div-msg-/g, '');
            console.log(pushkey);
            FirebaseDB.set(FirebaseDB.ref(Database, getVariable('MSG_ROOT') + `/${pushkey}`), null).then(() => {
                // nada
            }).catch((error) => {
                alert('An error occurred.\n' + error);
                console.error(error);
            });
        }
    }

    // Show share sheet on share button click
    ShareButton.onclick = async () => {
        try {
            await navigator.share({
                title: 'Send a secret message',
                text: `Send a message to ${CommonJS.decode(getVariable('UserData').name.fullname)} anonymously!\n`,
                url: LinkAnchor.href,
            });
        } catch (error) {
            if (!(error instanceof DOMException && error.code === 20)) alert('An error occurred.\nYour browser may not support the share feature implemented in this site. Please try a different browser.');
            console.error(error);
        }
    }
}

main();

console.log('site /home loaded');
