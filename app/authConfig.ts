export const msalconfig = {
    auth: {
        clientId: "40bafd50-ad27-4b77-a8cd-0b43e911ee82",
        authority: "https://login.microsoftonline.com/organizations",
        redirectUri: "http://localhost:3000/auth-callback",
    },
    cache: {
        cacheLocation: "sessionStorage", // This helps maintain session on refresh
        storeAuthStateInCookie: false,
    }
};

export const loginRequest = {
    scopes: ["User.Read"],
};