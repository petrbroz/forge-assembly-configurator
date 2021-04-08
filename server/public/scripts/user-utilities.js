export function userLoggedIn() {
    return !!USER;
}

export function updateLoginUI() {
    const $navigation = $('#navigation');
    if (userLoggedIn()) {
        $navigation.append(`
            <a class="btn btn-primary" href="/auth/logout">Logout (${USER.name})</a>
        `);
    } else {
        $navigation.append(`
            <a class="btn btn-primary" href="/auth/login">Login</a>
        `);
        $('[data-hidden-when=not-logged-in]').hide();
    }
}