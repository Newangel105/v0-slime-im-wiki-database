This is the perfect time to do this a new update for the game launched

So i need to automate the entire process using a single python file

1º Connect to the runnign ldplayer9 and copy the files at the following paths to the shared folder(C:\Users\Angel105\Documents\XuanZhi9\Pictures)
/data/app/com.bandainamcoent.tensuramrkww-oQOdmVQz-GwN_FDXxtONcA==/split_android_assetpack.apk
/data/app/com.bandainamcoent.tensuramrkww/files/dump.cs
/storage/emulated/0/Android/data/com.bandainamcoent.tensuramrkww/files/UnityCache/Shared

2º Rename the split_android_assetpack.apk to split_android_assetpack.zip and extrac the content, then copy the folder inside that will be assets\assetpack
Also copy the file dump.cs
And copy the folder Shared
These 2 folders and dump.cs file will be copied to D:\Slime Isekai Memories Game Files\Slime_Extractor
into a new created folder, can be named like new_folder_DD_MM_YY

3º Dump All Texture2D,Sprites and Text Assets from the shared folder, the texture2d and sprites go to
Assets\AssetsBundles
The Text Assets goes to TextAsset Folder
Dump All Text Assets from the assets\assetpack folder into a folder called Text_asset_pack

4º Copy everything from Text_asset_pack into the TextAsset folder and skip all files that are there already

5º Run all the necessary python files located at D:\Slime Isekai Memories Game Files\Slime_Extractor against this new TextAsset folder in order to generate all the necessary files for the website
Also probly analyse any needed images that are not already in D:\Slime Isekai Memories Game Files\website\v0-slime-im-wiki-database and put them in the correct spots the code needs
