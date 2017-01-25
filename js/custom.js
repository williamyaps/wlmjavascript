$(function () {
	"use strict";

	$(document).ready(function () {

		// Super Fish Main Menu Start
		if ($('#met-nav').length > 0) {
			$("#met-nav").show();
			var superfishOptions = {}
			$('#met-nav').superfish(superfishOptions);
		}
		// Super Fish Main Menu End

		// Responsive Menu Start
		if ($('#dl-menu').length > 0) {
			$('#dl-menu').dlmenu();
		}
		// Responsive Menu End

		// Main Nav Searchbar Start
		if ($("#met-nav-search").length > 0) {
			var searchbar_active = false;
			$("#met-nav-search").on('click', function () {
				var searchbar = $(this).parent().find(".met-nav-search-wrapper");
				if (searchbar_active) {
					// Close
					searchbar_active = false;
					searchbar.removeClass("fadeInRight");
					searchbar.addClass("fadeOutRight").fadeOut();
				}
				else {
					// Open
					searchbar_active = true;
					searchbar.removeClass("fadeOutRight");
					searchbar.css({
						"display": "block",
						"left": "-148px"
					});
					searchbar.addClass("fadeInRight");
				}

			});
		}
		// Main Nav Searchbar End

		// Breaking Newsticker Start
		if ($('.met-all-breaking').length > 0) {
			$(".met-all-breaking").show().css('display', 'inline-block');
			$('.met-all-breaking').newsTicker();
		}
		// Breaking Newsticker End

		// Main Content And Sidebar Slider
		if ($('#met-main-slider').length > 0) {
			$('#met-main-slider').lightSlider({
				item: 1,
				controls: false
			});
		}

		if ($('#met-sidebar-slider').length > 0) {
			$('#met-sidebar-slider').lightSlider({
				controls: false,
				item: 1
			});
		}
		// Main Content And Sidebar Slider End

		// Content Alfa 1 Start
		if ($("#content-alfa-1").length > 0) {

			var content_alfa_1 = $("#content-alfa-1").lightSlider({
				item: 2,
				loop: false,
				slideMove: 2,
				easing: 'cubic-bezier(0.25, 0, 0.25, 1)',
				speed: 600,
				pager: false,
				controls: false,
				slideMargin: 30,
				responsive: [
					{
						breakpoint: 480,
						settings: {
							item: 1,
							slideMove: 1
						}
					}
				]
			});

			$("#met-content-alfa-1-prev").on('click', function () {
				content_alfa_1.goToPrevSlide();
				return false;
			});

			$("#met-content-alfa-1-next").on('click', function () {
				content_alfa_1.goToNextSlide();
				return false;
			});
		}
		// Content Alfa 1 End

		// Content Alfa 2 Start
		if ($("#content-alfa-2").length > 0) {
			var content_alfa_2 = $("#content-alfa-2").lightSlider({
				item: 2,
				loop: false,
				slideMove: 2,
				easing: 'cubic-bezier(0.25, 0, 0.25, 1)',
				speed: 600,
				pager: false,
				controls: false,
				slideMargin: 30,
				responsive: [
					{
						breakpoint: 480,
						settings: {
							item: 1,
							slideMove: 1
						}
					}
				]
			});

			$("#met-content-alfa-2-prev").on('click', function () {
				content_alfa_2.goToPrevSlide();
				return false;
			});

			$("#met-content-alfa-2-next").on('click', function () {
				content_alfa_2.goToNextSlide();
				return false;
			});
		}
		// Content Alfa 2 End

		// Widget Hot Topics Start
		if ($("#met-hot-topic-widget").length > 0) {
			var met_hot_topic_widget = $("#met-hot-topic-widget").lightSlider({
				item: 1,
				pager: false,
				controls: false,
				adaptiveHeight: true
			});

			$("#met-hot-topics-prev").on('click', function () {
				met_hot_topic_widget.goToPrevSlide();
				return false;
			});

			$("#met-hot-topics-next").on('click', function () {
				met_hot_topic_widget.goToNextSlide();
				return false;
			});
		}
		// Widget Hot Topics End

		// Widget Event Schedule Start
		if ($("#met-scheulde-list").length > 0) {
			var met_scheulde_list = $("#met-scheulde-list").lightSlider({
				item: 1,
				pager: false,
				controls: false,
				responsive: [
					{
						breakpoint: 480,
						settings: {
							item: 1,
							slideMove: 1
						}
					}
				]
			});

			$("#met-event-scheulde-prev").on('click', function () {
				met_scheulde_list.goToPrevSlide();
				return false;
			});

			$("#met-event-scheulde-next").on('click', function () {
				met_scheulde_list.goToNextSlide();
				return false;
			});
		}
		// Widget Event Schedule End

		// Widget Twitter Slider Start
		if ($("#met-widget-tweet-list").length > 0) {
			$("#met-widget-tweet-list").lightSlider({
				speed: 400,
				auto: true,
				loop: true,
				slideEndAnimation: true,
				pager: false,
				controls: false,
				item: 4,
				vertical: true
			});
		}
		// Widget Twitter Slider End

		// Widget Gallery Tabs Start
		if ($('#tabs_container').length > 0) {
			var met_gallery_photos = $("#tabs_container").lightSlider({
				item: 1,
				pager: false,
				controls: false
			});

			$("#met-widget-gallery-prev").on('click', function () {
				met_gallery_photos.goToPrevSlide();
				return false;
			});

			$("#met-widget-gallery-next").on('click', function () {
				met_gallery_photos.goToNextSlide();
				return false;
			});
		}
		// Widget Gallery Tabs End

		// Lavalamp Widget Gallery Start
		if ($(".met-lavalamp-gallery").length > 0) {
			$(".met-lavalamp-gallery").lavalamp({
				easing: 'easeOutBack'
			});
		}
		// Lavalamp Widget Gallery End

		// Main Content Photo Slider Start
		if ($(".met-photo-items").length > 0) {
			var met_photo_items = $(".met-photo-items").lightSlider({
				item: 1,
				pager: false,
				controls: false
			});

			$("#met-content-photo-prev").on('click', function () {
				met_photo_items.goToPrevSlide();
				return false;
			});

			$("#met-content-photo-next").on('click', function () {
				met_photo_items.goToNextSlide();
				return false;
			});
		}
		// Main Content Photo Slider End

		// Full Gallery Page Slider Start
		if ($('#met-gallery-slider').length > 0) {
			$('#met-gallery-slider').lightSlider({
				gallery: true,
				item: 1,
				loop: true,
				slideMargin: 0,
				thumbItem: 9,
				responsive: [
					{
						breakpoint: 768,
						settings: {
							thumbItem: 6
						}
					},
					{
						breakpoint: 480,
						settings: {
							thumbItem: 4
						}
					}
				]
			});
		}
		// Full Gallery Page Slider End

		// Lavalamp Content Photos Start
		if ($(".met-lavalamp-photo").length > 0) {
			$(".met-lavalamp-photo").lavalamp({
				margins: true,
				easing: 'easeOutBack'
			});
		}
		// Lavalamp Content Photos End

		// Content Gamma Filter Start
		if ($('#met-content-gamma-filter').length > 0) {
			$('#met-content-gamma-filter').mixItUp();
		}
		// Content Gamma Filter End

		// Content Gallery And Sidebar Gallery Responsive Popup Start
		if ($(".met-lavalamp-gallery").length > 0) {
			$(".met-lavalamp-gallery").magnificPopup({
				delegate: 'a',
				type: 'image'
			});
		}

		if ($(".met-lavalamp-photo").length > 0) {
			$(".met-lavalamp-photo").magnificPopup({
				delegate: 'a',
				type: 'image'
			});
		}
		// Content Gallery And Sidebar Gallery Responsive Popup End

		// Page Scroll Top Start
		$.scrollUp({
			scrollName: 'met-scroll-up', // Element ID
			topDistance: '300', // Distance from top before showing element (px)
			topSpeed: 300, // Speed back to top (ms)
			animation: 'fade', // Fade, slide, none
			animationInSpeed: 200, // Animation in speed (ms)
			animationOutSpeed: 200, // Animation out speed (ms)
			scrollText: '', // Text for element
			activeOverlay: false // Set CSS color to display scrollUp active point, e.g '#00FFFF'
		});
		// Page Scroll Top End

		// SticyMenu Start
		if ($("#met-main-nav").length > 0 && $("#met-main-nav").attr("data-fixed") == 'on') {
			$("#met-main-nav").sticky({topSpacing: 0, bottomSpacing: 0, wrapperClassName: 'met-main-nav-wrapper'});
		}
		// SticyMenu End

		// Contact Google Maps Start
		if ($("#gmap").length > 0) {
			var met_contact_lat = $(".met-google-maps").attr("data-lat") != '' ? parseFloat($(".met-google-maps").attr("data-lat")) : "-18.019222";
			var met_contact_lng = $(".met-google-maps").attr("data-lng") != '' ? parseFloat($(".met-google-maps").attr("data-lng")) : "44.094315";
			var met_contact_zoom = $(".met-google-maps").attr("data-zoom") != '' ? parseInt($(".met-google-maps").attr("data-zoom")) : 13;
			var met_contact_title = $(".met-google-maps").attr("data-title") != '' ? $(".met-google-maps").attr("data-title") : "MetCreative Office";
			var met_contact_logo = $(".met-google-maps").attr("data-logo") != '' ? $(".met-google-maps").attr("data-logo") : "img/logo.png";

			$("#gmap").gMap({
				zoom: met_contact_zoom,
				markers: [
					{
						latitude: met_contact_lat,
						longitude: met_contact_lng,
						html: met_contact_title
					}
				],
				icon: {
					image: met_contact_logo,
					shadow: true,
					iconsize: [48, 50],
					shadowsize: true,
					iconanchor: [4, 19],
					infowindowanchor: [8, 2]
				}
			});
		}
		// Contact Google Maps End

		// Gallery Zoom Effect Start
		if ($(".met-gallery-zoom-effect").length > 0) {
			$('.met-gallery-zoom-effect').slickhover({
				speed:350,
				animateIn: true
			});
		}
		// Gallery Zoom Effect End

	});
});