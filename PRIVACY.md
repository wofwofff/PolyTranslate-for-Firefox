# Privacy

When you choose to translate text, PolyTranslate opens the website of your
selected provider, Yandex Translate or Google Translate, with that text in the
page URL. The selected provider receives and processes the text as part of that
request. Yandex is selected by default. Text is not sent merely because you
select it.

The extension does not include analytics or send data to a server operated by
the fork's maintainer. It uses Firefox sync storage for your extension settings.

The manifest requests page access to read text selections and display the
translation icon on websites and local files opened in Firefox. Firefox 153
or later requires separate user approval for local file access.

The Firefox manifest declares `websiteContent` because translation sends selected
web page text to the selected provider. Firefox presents this permission during
installation.
