(function () {
    'use strict';

    angular.module('angularUploader', ['session', 'ngDialog', 'angularStringFilters', 'angularThumb', 'angularAudio', 'angularSimpleUploader', 'cfp.loadingBar'])
        .factory('$musicUploader', ['ngDialog', '$timeout', function ($dialog, $timeout) {
            var audioUploader = {};
            var baseURL = 'http://www.bgtracks.com';

            audioUploader.show = function (cb, sound, hideTunes, hideSfx, defaultTab) {
                $dialog.open({
                    template: '/static/bower_components/angular-uploader/src/templates/audio-popup.html',
                    className: 'ngdialog-theme-plain',
                    controller: ['$scope', function ($scope) {
                        $scope.obj = {};
                        $scope.obj.sound = sound || '';
                        $scope.hideTunes = !!hideTunes;
                        $scope.hideSfx = !!hideSfx;

                        $scope.init = function () {
                            $.getJSON(baseURL + '/api/sfxs?sort=genre' + '&callback=?', function (obj) {
                                //console.log(obj);
                                $timeout(function () { $scope.sfxs = obj; });
                            });

                            $.getJSON(baseURL + '/api/tracks?sort=genre' + '&callback=?', function (obj) {
                                //console.log(obj);
                                $timeout(function () { $scope.tracks = obj; });
                            });

                            $.getJSON(baseURL + '/api/resources?sort=popularity&callback=?', function (obj) {
                                $timeout(function () { $scope.resources = obj; });
                            });

                            if (defaultTab) {
                                $timeout(function () { $('a[href="#' + defaultTab + '"').click(); }, 500);
                            }
                        };

                        $scope.absoluteURL = function (u) {
                            return /^http/i.test(u) ? u : baseURL + u;
                        };

                        $scope.save = function () {
                            $timeout(function () { cb($scope.obj.sound || null); });
                            $scope.closeThisDialog();
                        };

                        $scope.init();
                    }]
                });
            };

            return audioUploader;
        }])
        .factory('$mediaUploader', ['ngDialog', '$timeout', '$notice', '$q', '$http', 'cfpLoadingBar', function ($dialog, $timeout, $notice, $q, $http, cfpLoadingBar) {
            var mediaUploader = {};

            mediaUploader.show = function (args) {
                var promises = [];
                var imageSearch;

                $dialog.open({
                    template: '/static/bower_components/angular-uploader/src/templates/media-popup.html',
                    className: 'ngdialog-theme-plain custom-width',
                    controller: ['$scope', function ($scope) {
                        $scope.cb = args.cb;
                        $scope.tab = args.activeTab;
                        $scope.term = args.term || '';
                        $scope.singular = args.singular;
                        $scope.withCaptions = args.withCaptions;
                        $scope.tabs = args.tabs || {'image-search': true, 'video-search': true, 'upload': true};
                        $scope.license = args.license || 'any';

                        $scope.imageResults = [];
                        $scope.sources = {};
                        $scope.urls = [];

                        $scope.init = function () {
                            $scope.$watch('sources', function () {
                                $scope.urls.splice(0, $scope.urls.length);

                                angular.forEach($scope.sources, function (v, k) {
                                    if (v) {
                                        $scope.urls.push(k);
                                    }
                                });
                            }, true);

                            if ($scope.tab) {
                                $timeout(function () {
                                    $('a[href="#' + $scope.tab + '"').click();

                                    if ($scope.term) {
                                        $('#' + $scope.tab + '-button').click();
                                    }
                                }, 500);
                            }
                        };

                        $scope.upload = function (uploads) {
                            if ($scope.singular) {
                                $scope.urls[0] = uploads;
                            } else {
                                angular.forEach(uploads, function (url) {
                                    $scope.urls.push(url);
                                });
                            }
                        };

                        $scope.loadImages = function (term) {
                            if (typeof(window.imageSearch) !== 'undefined') {
                                $scope.searchImages(term);
                            } else {
                                if (typeof(google) !== 'undefined') {
                                    google.load('search', '1', {'callback': 'window.imageSearch = google.search.ImageSearch;'});
                                }

                                setTimeout($scope.loadImages, 1000, term);
                            }
                        };

                        $scope.searchImages = function (term) {
                            $scope.imageResults = [];
                            $scope.moreImages = false;

                            imageSearch = new window.imageSearch();
                            imageSearch.setSearchCompleteCallback(this, function () {
                                cfpLoadingBar.complete();

                                angular.forEach(imageSearch.results, function (result) {
                                    $scope.imageResults.push({thumb: result.tbUrl, src: result.url, caption: result.contentNoFormatting});
                                });

                                $timeout(function () {
                                    var cursor = imageSearch.cursor;
                                    var totalPages = cursor.pages.length;

                                    $scope.moreImages = cursor.currentPageIndex < totalPages - 1 ? cursor.currentPageIndex + 1 : false;
                                });
                            }, null);

                            imageSearch.setResultSetSize(8);
                            imageSearch.setNoHtmlGeneration();

                            if ($scope.license === 'creativeCommon') {
                                imageSearch.setRestriction(window.imageSearch.RESTRICT_RIGHTS, window.imageSearch.RIGHTS_REUSE);
                            }

                            imageSearch.execute(term);
                            cfpLoadingBar.start();
                        };

                        $scope.loadMoreImages = function () {
                            if ($scope.moreImages > 0) {
                                imageSearch.gotoPage($scope.moreImages);
                            }
                        };

                        $scope.loadVideos = function (term) {
                            if (typeof(window.videoSearch) !== 'undefined') {
                                $scope.searchVideos(term);
                            } else {
                                if (typeof(gapi) !== 'undefined') {
                                    gapi.client.load('youtube', 'v3', function () {window.videoSearch = gapi.client.youtube.search.list;});
                                }
                                setTimeout($scope.loadVideos, 1000, term);
                            }
                        };

                        $scope.searchVideos = function (term, token) {
                            $scope.moreVideos = false;

                            var api_key = 'AIzaSyCBdyG0mb-kaxrHkY3bH3LmPGqigFrEtVg ';
                            var params = {key: api_key, type: 'video', q: term, part: 'snippet', videoLicense: $scope.license || 'any', videoEmbeddable: true, maxResults: 24};

                            if (token) {
                                params['pageToken'] = token;
                            } else {
                                $scope.videoResults = [];
                            }

                            var request = window.videoSearch(params);

                            request.execute(function (response) {
                                cfpLoadingBar.complete();

                                angular.forEach(response.items, function (result) {
                                    $scope.videoResults.push({
                                        thumb: result.snippet.thumbnails.default.url,
                                        src: 'http://www.youtube.com/watch?v=' + result.id.videoId,
                                        caption: result.snippet.title
                                    });
                                });

                                $timeout(function () {$scope.moreVideos = response.nextPageToken ? response.nextPageToken : false;});
                            });

                            cfpLoadingBar.start();
                        };

                        $scope.add = function (url) {
                            if ($scope.singular) {
                                $scope.urls[0] = url;
                            } else {
                                $scope.sources[url] = !$scope.sources[url];
                            }
                        };

                        $scope.sel = function (url) {
                            return ($scope.singular && (url === $scope.urls[0])) || $scope.sources[url];
                        };

                        $scope.itemType = function (url) {
                            return (/youtube\.com/i.test(url) || /(\.mp4)$/.test(url)) ? 'video' : 'photo';
                        };

                        $scope.save = function () {
                            if (($scope.urls.length > 0) && ($scope.cb instanceof Function)) {
                                var proxy = [];
                                for (var i = $scope.urls.length - 1; i >= 0; i--) {
                                    var url = $scope.urls[i];
                                    if (($scope.itemType(url) === 'photo') && !/s3\.amazonaws\.com/i.test(url) && !/cloudfront\.net/i.test(url)) {
                                        proxy.push(url);
                                        $scope.urls.splice(i, 1);
                                    }
                                }

                                if (proxy.length > 0) {
                                    $scope.processing = true;

                                    $http.post('/generic/url-proxy', {urls: proxy}).then(
                                        function success(obj) {
                                            if ($scope.processing) {
                                                var urls = obj.data;
                                                if (urls && urls.length > 0) {
                                                    angular.forEach(urls, function (url) {
                                                        if (url && url.copy) {
                                                            $scope.urls.push(url.copy);
                                                            angular.extend(_.findWhere($scope.imageResults, {src: url.src}) || {}, {src: url.copy});
                                                        }
                                                    });
                                                }

                                                $scope.addURLs();
                                            }
                                        },
                                        $scope.addURLs
                                    );
                                } else {
                                    $scope.addURLs();
                                }
                            } else {
                                $scope.closeThisDialog();
                            }
                        };

                        $scope.abort = function () {
                            $scope.processing = false;
                        };

                        $scope.addURLs = function () {
                            var urls = $scope.urls;
                            var results = [];

                            if ($scope.withCaptions) {
                                angular.forEach(urls, function (url) {
                                    results.push(_.findWhere($scope.videoResults, {src: url}) || _.findWhere($scope.imageResults, {src: url}) || {url: url});
                                });
                            } else {
                                results = results.concat(urls);
                            }

                            $timeout(function () { $scope.cb(results ? ($scope.singular ? results[0] : results) : []); });
                            $scope.closeThisDialog();
                        };

                        $scope.init();
                    }]
                });
            };

            return mediaUploader;
        }])
        .directive('sfxButton', ['$musicUploader', function ($musicUploader) {
            return {
                restrict: 'A',
                require: 'ngModel',
                scope: {},
                link: function ($scope, element, attrs, ngModel) {
                    element.click(function () {
                        $musicUploader.show(function save(url) {
                            ngModel.$setViewValue(url);
                        }, ngModel.$viewValue, true, false);
                    });
                }
            }
        }])
        .directive('musicButton', ['$musicUploader', function ($musicUploader) {
            return {
                restrict: 'A',
                require: 'ngModel',
                scope: {},
                link: function ($scope, element, attrs, ngModel) {
                    element.click(function () {
                        $musicUploader.show(function save(url) {
                            ngModel.$setViewValue(url);
                        }, ngModel.$viewValue, false, true);
                    });
                }
            }
        }])
})();


