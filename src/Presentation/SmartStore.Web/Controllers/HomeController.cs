using System;
using System.Linq;
using System.Web.Mvc;
using SmartStore.Core.Data;
using SmartStore.Core.Domain;
using SmartStore.Core.Domain.Common;
using SmartStore.Core.Domain.Customers;
using SmartStore.Core.Domain.Seo;
using SmartStore.Core.Email;
using SmartStore.Services.Common;
using SmartStore.Services.Customers;
using SmartStore.Services.Localization;
using SmartStore.Services.Messages;
using SmartStore.Services.Topics;
using SmartStore.Web.Framework.Controllers;
using SmartStore.Web.Framework.Filters;
using SmartStore.Web.Framework.Security;
using SmartStore.Web.Framework.Seo;
using SmartStore.Web.Models.Common;


namespace SmartStore.Web.Controllers
{
    public partial class HomeController : PublicControllerBase
    {
        private readonly Lazy<ITopicService> _topicService;
        private readonly Lazy<CaptchaSettings> _captchaSettings;
        private readonly Lazy<CommonSettings> _commonSettings;
        private readonly Lazy<PrivacySettings> _privacySettings;
        private readonly Lazy<HomePageSettings> _homePageSettings;
        private readonly Lazy<StoreInformationSettings> _storeInformationSettings;
        private readonly Lazy<IAddressService> _addressService;

        public HomeController(
            Lazy<ITopicService> topicService,
            Lazy<CaptchaSettings> captchaSettings,
            Lazy<CommonSettings> commonSettings,
            Lazy<PrivacySettings> privacySettings,
            Lazy<HomePageSettings> homePageSettings,
            Lazy<StoreInformationSettings> storeInformationSettings,
            Lazy<IAddressService> addressService)
        {
            _topicService = topicService;
            _captchaSettings = captchaSettings;
            _commonSettings = commonSettings;
            _privacySettings = privacySettings;
            _homePageSettings = homePageSettings;
            _storeInformationSettings = storeInformationSettings;
            _addressService = addressService;
        }

        [RewriteUrl(SslRequirement.No)]
        public ActionResult Index()
        {
            var storeId = Services.StoreContext.CurrentStore.Id;
            ViewBag.MetaTitle = _homePageSettings.Value.GetLocalizedSetting(x => x.MetaTitle, storeId);
            ViewBag.MetaDescription = _homePageSettings.Value.GetLocalizedSetting(x => x.MetaDescription, storeId);
            ViewBag.MetaKeywords = _homePageSettings.Value.GetLocalizedSetting(x => x.MetaKeywords, storeId);

            return View();
        }

        public ActionResult StoreClosed()
        {
            if (!_storeInformationSettings.Value.StoreClosed)
            {
                return RedirectToRoute("HomePage");
            }

            return View();
        }

        [RewriteUrl(SslRequirement.No)]
        [GdprConsent]
        public ActionResult ContactUs()
        {
            var topic = _topicService.Value.GetTopicBySystemName("ContactUs", 0, false);

            var model = new ContactUsModel
            {
                Email = Services.WorkContext.CurrentCustomer.Email,
                FullName = Services.WorkContext.CurrentCustomer.GetFullName(),
                FullNameRequired = _privacySettings.Value.FullNameOnContactUsRequired,
                DisplayCaptcha = _captchaSettings.Value.CanDisplayCaptcha && _captchaSettings.Value.ShowOnContactUsPage,
                MetaKeywords = topic?.GetLocalized(x => x.MetaKeywords),
                MetaDescription = topic?.GetLocalized(x => x.MetaDescription),
                MetaTitle = topic?.GetLocalized(x => x.MetaTitle),
            };

            return View(model);
        }

        [HttpPost, ActionName("ContactUs")]
        [ValidateCaptcha, ValidateHoneypot]
        [GdprConsent]
        public ActionResult ContactUsSend(ContactUsModel model, string captchaError)
        {
            if (_captchaSettings.Value.ShowOnContactUsPage && captchaError.HasValue())
            {
                ModelState.AddModelError("", captchaError);
            }

            if (ModelState.IsValid)
            {
                var customer = Services.WorkContext.CurrentCustomer;
                var email = model.Email.Trim();
                var fullName = model.FullName;
                var subject = T("ContactUs.EmailSubject", Services.StoreContext.CurrentStore.Name);
                var body = Core.Html.HtmlUtils.ConvertPlainTextToHtml(model.Enquiry.HtmlEncode());

                // Required for some SMTP servers.
                EmailAddress sender = null;
                if (!_commonSettings.Value.UseSystemEmailForContactUsForm)
                {
                    sender = new EmailAddress(email, fullName);
                }

                var msg = Services.MessageFactory.SendContactUsMessage(customer, email, fullName, subject, body, sender);

                if (msg?.Email?.Id != null)
                {
                    model.SuccessfullySent = true;
                    model.Result = T("ContactUs.YourEnquiryHasBeenSent");
                    Services.CustomerActivity.InsertActivity("PublicStore.ContactUs", T("ActivityLog.PublicStore.ContactUs"));
                }
                else
                {
                    ModelState.AddModelError("", T("Common.Error.SendMail"));
                    model.Result = T("Common.Error.SendMail");
                }

                return View(model);
            }

            model.DisplayCaptcha = _captchaSettings.Value.CanDisplayCaptcha && _captchaSettings.Value.ShowOnContactUsPage;

            return View(model);
        }

        public ActionResult ChangeAddress(int addressId)  //<!-- KB -->
        {
            var topicChangeAddress = _topicService.Value.GetTopicBySystemName("ChangeAddress", 0, false);
            var address = _addressService.Value.GetAddressById(addressId);

            int? countryId = address?.CountryId;
            var Country = _addressService.Value.GetAddressTotalByCountryId(countryId ?? 0); 

            var modelChangeAddress = new ChangeAddressModel
            {
                ChangeAddressFirstName = address.FirstName,
                ChangeAddressTitle = address.Title,
                ChangeAddressLastName = address.LastName,

                ChangeAddressAddressType = address.AddressType,
                ChangeAddressAddress1 = address.Address1,
                ChangeAddressZipPostalCode = address.ZipPostalCode,
                ChangeAddressCity = address.City,
                ChangeAddressCountry = address.Country.Name,
                ChangeAddressPhoneNumber = address.PhoneNumber,

                ChangeAddressDisplayCaptcha = _captchaSettings.Value.CanDisplayCaptcha && _captchaSettings.Value.ShowOnChangeAddressPage,
                ChangeAddressMetaKeywords = topicChangeAddress?.GetLocalized(x => x.MetaKeywords),
                ChangeAddressMetaDescription = topicChangeAddress?.GetLocalized(x => x.MetaDescription),
                ChangeAddressMetaTitle = topicChangeAddress?.GetLocalized(x => x.MetaTitle),
            };

            return View(modelChangeAddress);
        }

        [HttpPost, ActionName("ChangeAddress")]
        [ValidateCaptcha, ValidateHoneypot]
        [GdprConsent]
        public ActionResult ChangeAddressSend(ChangeAddressModel model, string captchaError, int addressId)
        {
            if (_captchaSettings.Value.ShowOnChangeAddressPage && captchaError.HasValue())
            {
                ModelState.AddModelError("", captchaError);
            }

            if (ModelState.IsValid)
            {
                var address = _addressService.Value.GetAddressById(addressId);
                var addresstype = address.AddressType;

                var customer = Services.WorkContext.CurrentCustomer;
                var email = model.ChangeAddressEmail.ToString();
                var sender = model.ChangeAddressLastName;
                
                var phonenumber = model.ChangeAddressPhoneNumber;
                var subject = T("ChangeAddress.EmailSubject", Services.StoreContext.CurrentStore.Name);
                var addressToSAP = model.ChangeAddressFirstName;
                var title = model.ChangeAddressTitle;

                var address1 = model.ChangeAddressAddress1;
                var zippostalcode = model.ChangeAddressZipPostalCode;
                var city = model.ChangeAddressCity;
                var country = model.ChangeAddressCountry;

                var sb = new System.Text.StringBuilder();
                if (addresstype.StartsWith("B")){ sb.AppendLine(@T("ChangeAddressBillingAddress")); }  
                else { sb.AppendLine(@T("ChangeAddressShippingAddress")); }
                sb.AppendLine(addressToSAP + "-" + title);
                sb.AppendLine(sender);
                sb.AppendLine(address1);
                sb.AppendLine(city);
                sb.AppendLine(zippostalcode);
                sb.AppendLine(country);


                var body = Core.Html.HtmlUtils.ConvertPlainTextToHtml(sb.ToString());

                // Required for some SMTP servers.
                //EmailAddress sender = null;
                //if (!_commonSettings.Value.UseSystemEmailForContactUsForm)
                //{
                //    sender = new EmailAddress(email, fullName);
                //}

                var msg = Services.MessageFactory.SendChangeAddressMessage(customer, email, sender, addresstype, phonenumber, subject, body);

                if (msg?.Email?.Id != null)
                {
                    model.ChangeAddressSuccessfullySent = true;
                    model.ChangeAddressResult = T("ChangeAddress.YourEnquiryHasBeenSent");
                    Services.CustomerActivity.InsertActivity("PublicStore.ChangeAddress", T("ActivityLog.PublicStore.ChangeAddress"));
                }
                else
                {
                    ModelState.AddModelError("", T("Common.Error.SendMail"));
                    model.ChangeAddressResult = T("Common.Error.SendMail");
                }

                return View(model);
            }

            model.ChangeAddressDisplayCaptcha = _captchaSettings.Value.CanDisplayCaptcha && _captchaSettings.Value.ShowOnChangeAddressPage;

            return View(model);
        }

        [RewriteUrl(SslRequirement.No)]
        public ActionResult Sitemap()
        {
            return RedirectPermanent(Services.StoreContext.CurrentStore.Url);
        }
    }
}
